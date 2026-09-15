import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { useAppConfig } from '@/hooks/use-app-config';
import { useSync } from '@/hooks/use-sync';
import { api, ApiError, type OtpChallenge } from '@/lib/api-client';
// A WrongPasswordError needs no branch here: it carries its own wording, and
// showFailure prints it. Settings branches on the type because it has to
// choose between an inline field error and a toast.
import {
  buildSignupMaterial,
  deriveLoginVerifier,
  unlockKeyBundle,
  type SessionKeys,
} from '@/lib/account';
import { generateRecoveryPhrase } from '@/lib/key-management';
import { unlockKeyVault } from '@/lib/key-vault';
import { EmailStep } from '@/components/account/email-step';
import { CodeStep } from '@/components/account/code-step';
import { CreatePasswordStep } from '@/components/account/create-password-step';
import { RecoveryPhraseStep } from '@/components/account/recovery-phrase-step';
import { EnterPasswordStep } from '@/components/account/enter-password-step';

/**
 * The one auth route. Signing up and signing in are the same flow with one
 * branch in the middle, not two routes that happen to look alike.
 *
 * `/auth/verify-otp` returns `verifierSalt: null` for an account that has
 * requested a code but never completed signup, and a real salt for one that
 * has (`worker/src/services/users.ts:253`). That is not an error condition —
 * it is how the client routes itself, and it is the only thing that decides
 * which half of the flow runs.
 *
 *   email ──► code ──► verify-otp
 *                          │
 *         salt === null ──► password + confirm ──► recovery phrase ──► signup
 *                          │
 *         salt !== null ──► password ──► login-complete
 *
 * ## Why none of this lives in the URL
 *
 * The old version drove its steps from a search param. Past the code step this
 * flow holds a bridge token, a password and a recovery phrase, none of which
 * may be written anywhere that outlives the tab. So the step is component
 * state, and a refresh mid-flow drops the user back at the email step — which
 * is the correct outcome rather than a limitation: everything held at that
 * point is single-use anyway.
 *
 * `?email=` is still read on entry, because an address is not a secret and
 * pre-filling it is the whole value of the link.
 */

type Step = 'email' | 'code' | 'create-password' | 'recovery-phrase' | 'password';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, verifyOtp, isAuthenticated, user, checkAuth } = useAuth();
  const { isInitialized, isLoading: configLoading } = useAppConfig();
  const { unlockWithPassword, push, pull } = useSync();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Held only for the hop between the two signup steps, and cleared the moment
  // the account exists. The phrase in particular is shown once and stored
  // nowhere else — not in sessionStorage, not in the URL, not server-side.
  const [signupPassword, setSignupPassword] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');

  /**
   * Where a session that has just been *signed in to* belongs.
   *
   * Only the sign-in and unlock paths come through here, because only they
   * arrive at a vault they have not seen and have to ask the server what is in
   * it. Signup knows its own answer without asking — see `handleSignup`.
   *
   * A device with a budget on it never pulls automatically: restoring replaces
   * every local table, so that stays a deliberate choice in Settings. A device
   * with nothing on it is the case the old separate "restore" step existed for,
   * and it is folded in here.
   */
  const goToUnlockedDestination = useCallback(async () => {
    if (isInitialized) {
      navigate('/settings', { replace: true });
      return;
    }

    // Three outcomes, not two. "The check failed" is not "there is nothing
    // there": collapsing them drops a returning user who just typed the right
    // password into the first-run wizard on a dropped request.
    let vaultVersion: number | null = null;
    try {
      vaultVersion = (await api.vault.getMetadata()).version;
    } catch {
      vaultVersion = null;
    }

    if (vaultVersion === null) {
      setError(
        'You are signed in, but we could not reach your cloud backup. Try again in a moment.',
      );
      setLoading(false);
      return;
    }

    if (vaultVersion > 0) {
      await pull();
      // pull() marks the database initialised, so the app shell will render
      // rather than bouncing back to the landing page.
      navigate('/cash-flow', { replace: true });
    } else {
      navigate('/?setup=1', { replace: true });
    }
  }, [isInitialized, navigate, pull]);

  /**
   * Someone arriving with a session already live — a cookie that outlived the
   * tab. They need no code, only the password that opens their wrapped rows,
   * so drop them straight at the unlock prompt. Mid-flow steps are left alone.
   */
  useEffect(() => {
    if (!isAuthenticated || configLoading || step !== 'email') return;

    if (isInitialized) {
      navigate('/settings', { replace: true });
      return;
    }
    setEmail((current) => user?.email ?? current);
    setStep('password');
  }, [isAuthenticated, configLoading, isInitialized, step, navigate, user?.email]);

  /** Put a failure on screen and hand the form back. Sets state; does not throw. */
  const showFailure = (err: unknown, fallback: string) => {
    setError(err instanceof Error ? err.message : fallback);
    setLoading(false);
  };

  const handleEmail = async (submitted: string) => {
    setError(null);
    setLoading(true);
    try {
      await login(submitted);
      setEmail(submitted);
      setStep('code');
      setLoading(false);
    } catch (err) {
      showFailure(err, 'Could not send a code. Please try again.');
    }
  };

  const handleResend = () => {
    setError(null);
    login(email).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not resend the code.');
    });
  };

  const handleCode = async (code: string) => {
    setError(null);
    setLoading(true);
    try {
      const otpChallenge = await verifyOtp(email, code);
      setChallenge(otpChallenge);
      setStep(otpChallenge.verifierSalt === null ? 'create-password' : 'password');
      setLoading(false);
    } catch (err) {
      showFailure(err, 'That code was not accepted. Please try again.');
    }
  };

  const handleCreatePassword = (password: string) => {
    setError(null);
    // Generated here rather than in the step component so that re-rendering
    // that component can never mint a second phrase and silently discard the
    // one the user is looking at.
    setSignupPassword(password);
    setRecoveryPhrase(generateRecoveryPhrase());
    setStep('recovery-phrase');
  };

  const handleSignup = async () => {
    if (!challenge) return;
    setError(null);
    setLoading(true);

    let keys: SessionKeys;
    try {
      const material = await buildSignupMaterial(signupPassword, recoveryPhrase);
      keys = material.keys;
      await api.auth.signup({
        ...material.body,
        authPendingToken: challenge.authPendingToken,
        // The 7-day default. Someone who wants longer can choose it on their
        // next sign-in; a session length is not this screen's decision to make
        // on their behalf.
        rememberMe: false,
      });
    } catch (err) {
      showFailure(err, 'Could not create your account. Please try again.');
      return;
    }

    // Past this line the account exists and the bridge token is spent, so
    // nothing below may report itself as a failed signup — "try again" would
    // be advice that cannot work.
    setSignupPassword('');
    setRecoveryPhrase('');
    unlockKeyVault(keys);
    await checkAuth();

    // The first push belongs in the flow rather than being left to the user
    // (plan section 5), but a push that fails is not a signup that failed: the
    // account is real and usable, and the budget is still safe on this device.
    try {
      await push();
    } catch {
      toast.warning('Your account is ready, but your budget has not uploaded yet', {
        description: 'Use Push in Settings once you are back online.',
      });
    }

    // Deliberately not goToUnlockedDestination. That helper asks the server
    // what is in the vault, which is the right question after a sign-in and the
    // wrong one here: this flow just wrote the vault, so the cloud copy is the
    // local budget. Asking anyway would pull back the bytes we uploaded a line
    // ago and — on a device that has not been set up — mark the empty database
    // initialised, walking the user past the opening-balance wizard into an
    // empty app. Navigating is also synchronous, so there is no late failure
    // left to report on a signup that has already succeeded.
    navigate(isInitialized ? '/settings' : '/?setup=1', { replace: true });
  };

  const handlePassword = async (password: string, rememberMe: boolean) => {
    setError(null);
    setLoading(true);

    try {
      if (challenge) {
        const verifierCandidate = await deriveLoginVerifier(password, challenge);
        const session = await api.auth.loginComplete(
          challenge.authPendingToken,
          verifierCandidate,
          rememberMe,
        );
        unlockKeyVault(await unlockKeyBundle(password, session.keyBundle));
        await checkAuth();
      } else {
        // Already signed in — no bridge token to spend, so this is a local
        // unlock against the live session.
        await unlockWithPassword(password);
      }

      await goToUnlockedDestination();
    } catch (err) {
      // A wrong password on the sign-in path spends the bridge token, so there
      // is no second attempt: send them back for a fresh code rather than
      // leaving them retyping into a form that can no longer succeed.
      if (err instanceof ApiError && err.data?.['code'] === 'VERIFIER_MISMATCH') {
        setChallenge(null);
        setStep('code');
        setError('That password was not right. We have used up your code — request a new one.');
        setLoading(false);
        return;
      }
      // On the unlock path nothing was spent, so the form stays put and the
      // password can simply be retyped.
      showFailure(err, 'Could not sign you in. Please try again.');
    }
  };

  const backToEmail = () => {
    setStep('email');
    setChallenge(null);
    setSignupPassword('');
    setRecoveryPhrase('');
    setError(null);
    setLoading(false);
  };

  // Holding a bridge token is what separates completing a sign-in from
  // unlocking a session that is already live. Decided once, because the prompt
  // and its escape hatch have to agree about which one this is.
  const passwordMode = challenge ? 'sign-in' : 'unlock';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        {step === 'email' && (
          <EmailStep
            initialEmail={email}
            onSubmit={handleEmail}
            loading={loading}
            error={error}
            // Before setup there is no app to go back to — /cash-flow would
            // bounce off the RootLayout guard.
            backTo={isInitialized ? '/cash-flow' : '/welcome'}
            backLabel={isInitialized ? 'Back to app' : 'Back to home'}
          />
        )}

        {step === 'code' && (
          <CodeStep
            email={email}
            onSubmit={handleCode}
            onResend={handleResend}
            onBack={backToEmail}
            loading={loading}
            error={error}
          />
        )}

        {step === 'create-password' && (
          <CreatePasswordStep
            onSubmit={handleCreatePassword}
            onBack={backToEmail}
            loading={loading}
            error={error}
          />
        )}

        {step === 'recovery-phrase' && (
          <RecoveryPhraseStep
            phrase={recoveryPhrase}
            onAcknowledge={handleSignup}
            loading={loading}
            error={error}
          />
        )}

        {step === 'password' && (
          <EnterPasswordStep
            mode={passwordMode}
            email={email}
            onSubmit={handlePassword}
            onBack={passwordMode === 'sign-in' ? backToEmail : () => navigate('/?setup=1')}
            loading={loading}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
