import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { useAppConfig } from '@/hooks/use-app-config';
import { useSync } from '@/hooks/use-sync';
import { api, ApiError, type KeyBundle, type OtpChallenge } from '@/lib/api-client';
// A WrongPasswordError needs no branch here: it carries its own wording, and
// showFailure prints it. Settings branches on the type because it has to
// choose between an inline field error and a toast.
import {
  buildPasswordResetMaterial,
  buildSignupMaterial,
  deriveLoginVerifier,
  unlockKeyBundle,
  unlockKeyBundleWithPhrase,
  type SessionKeys,
} from '@/lib/account';
import { generateRecoveryPhrase } from '@/lib/key-management';
import { unlockKeyVault } from '@/lib/key-vault';
import { EmailStep } from '@/components/account/email-step';
import { CodeStep } from '@/components/account/code-step';
import { CreatePasswordStep } from '@/components/account/create-password-step';
import { RecoveryPhraseStep } from '@/components/account/recovery-phrase-step';
import { RecoveryPhraseEntryStep } from '@/components/account/recovery-phrase-entry-step';
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
 *                               │
 *                     forgot it ──► phrase ──► new password ──► recovery-reset
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

type Step =
  | 'email'
  | 'code'
  | 'create-password'
  | 'show-recovery-phrase'
  | 'password'
  | 'enter-recovery-phrase'
  | 'reset-password';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, logout, verifyOtp, isAuthenticated, user, checkAuth } = useAuth();
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
   * The recovery branch's two pieces of held state.
   *
   * `recoveryBundle` is kept so a mistyped phrase can be retried for free. The
   * bridge token is spent fetching it, once; every attempt after that unwraps
   * locally against the copy already in hand, with no server contact and
   * nothing further to spend. Dropping it would make each retry cost a fresh
   * emailed code, which is the one thing this screen's user cannot easily do —
   * they are already having a bad day.
   *
   * `recoveredKeys` holds the unwrapped MasterKey and private key between
   * proving the phrase and choosing the new password. They are the same keys
   * throughout; the reset only re-wraps them.
   */
  const [recoveryBundle, setRecoveryBundle] = useState<KeyBundle | null>(null);
  const [recoveredKeys, setRecoveredKeys] = useState<SessionKeys | null>(null);

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

  /**
   * Back to the start, holding nothing.
   *
   * Every exit from a mid-flow step lands here, so it clears all of it rather
   * than the pieces any one caller happens to have touched — a step added later
   * that stashes something new is one line here away from being cleaned up on
   * every path at once, instead of on the paths someone remembered.
   */
  const backToEmail = () => {
    setStep('email');
    setChallenge(null);
    setSignupPassword('');
    setRecoveryPhrase('');
    setRecoveryBundle(null);
    setRecoveredKeys(null);
    setError(null);
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
    setStep('show-recovery-phrase');
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

  const handleForgotPassword = () => {
    setError(null);
    setStep('enter-recovery-phrase');
  };

  /**
   * Prove the recovery phrase, which is entirely a local operation once the key
   * bundle is in hand.
   *
   * The server is never told whether the phrase was right. It hands over the
   * wrapped rows on the strength of the emailed code alone, and whether they
   * open happens in this browser — which is the same property that makes the
   * whole scheme end-to-end encrypted, seen from the recovery side.
   */
  const handleRecoveryPhrase = async (phrase: string) => {
    if (!challenge) return;
    setError(null);
    setLoading(true);

    try {
      let bundle = recoveryBundle;
      if (!bundle) {
        // Spends the bridge token. Only ever reached once per code, because the
        // bundle is kept for retries below.
        bundle = (await api.auth.loginCompleteViaRecovery(challenge.authPendingToken)).keyBundle;
        setRecoveryBundle(bundle);
      }

      setRecoveredKeys(await unlockKeyBundleWithPhrase(phrase, bundle));
      setStep('reset-password');
      setLoading(false);
    } catch (err) {
      showFailure(err, 'We could not check that recovery phrase. Please try again.');
    }
  };

  /**
   * Re-wrap the recovered keys under a new password and upload them.
   *
   * Afterwards the user signs in again rather than continuing here. The session
   * this branch is holding carries the `rec` flag, which reaches only
   * `/auth/key-bundle` and `/auth/recovery-reset` — it cannot push or pull, so
   * carrying it into the app would mean a signed-in state that silently fails
   * at everything. Logging out and asking for one more code is the honest
   * version, and it costs a minute on the rarest flow in the app.
   */
  const handleRecoveryPassword = async (newPassword: string) => {
    if (!recoveredKeys) return;
    setError(null);
    setLoading(true);

    try {
      await api.auth.recoveryReset(await buildPasswordResetMaterial(newPassword, recoveredKeys));
    } catch (err) {
      // Everything this branch holds is dropped on the failure path too. The
      // reset cannot be retried from here — the hourly budget is already spent
      // — so keeping a MasterKey and a dead bridge token buys nothing and only
      // widens the window they sit in.
      backToEmail();
      // After `backToEmail`, which clears `error` as part of the reset.
      //
      // Deliberately not "try again": the endpoint allows one attempt per hour
      // and spends that budget on entry, so a timeout here may well have
      // written the new rows anyway. Sending them to sign in finds out.
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Your password may already have been changed. Sign in with the new one. If that fails, try again in an hour.'
          : 'We could not finish changing your password. Sign in with the new one to check whether it took effect.',
      );
      return;
    }

    // Past this line the password is changed and nothing below may report a
    // failure as a failed reset.
    try {
      await logout();
    } catch {
      // The recovery session dies on its own in five minutes. A logout that
      // fails delays that and breaks nothing.
      //
      // Nothing here calls `checkAuth` afterwards, deliberately. This branch
      // never told the auth hook it was signed in — only `/auth/*` knows about
      // the recovery cookie — so asking now would, on exactly this failure,
      // report a live session and let the redirect effect walk a `rec` token
      // into the app. That is the state the doc comment above exists to avoid.
    }

    toast.success('Your password has been changed', {
      description: 'Sign in with your new password to finish.',
    });
    backToEmail();
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

        {step === 'show-recovery-phrase' && (
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
            // Only the sign-in path holds a bridge token, and recovery needs
            // one. From an unlock there is nothing to spend, so no offer.
            onForgotPassword={passwordMode === 'sign-in' ? handleForgotPassword : undefined}
            loading={loading}
            error={error}
          />
        )}

        {step === 'enter-recovery-phrase' && (
          <RecoveryPhraseEntryStep
            onSubmit={handleRecoveryPhrase}
            // Back to the password prompt, not to the email step: the bridge
            // token is still good, so someone who suddenly remembers their
            // password loses nothing by changing their mind here.
            onBack={() => {
              setError(null);
              setStep('password');
            }}
            loading={loading}
            error={error}
          />
        )}

        {step === 'reset-password' && (
          <CreatePasswordStep
            mode="reset"
            onSubmit={handleRecoveryPassword}
            onBack={backToEmail}
            loading={loading}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
