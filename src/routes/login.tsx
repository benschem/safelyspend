import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { Cloud, Mail, ArrowRight, ArrowLeft, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { useAppConfig } from '@/hooks/use-app-config';
import { useSync } from '@/hooks/use-sync';
import { api } from '@/lib/api-client';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { verify, login, isAuthenticated, user } = useAuth();
  const { isInitialized, isLoading: configLoading } = useAppConfig();
  const { setPassphrase, pull } = useSync();

  const step = searchParams.get('step') ?? 'email';
  const emailParam = searchParams.get('email') ?? '';

  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState('');
  const [passphrase, setPassphraseInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);

  const codeInputRef = useRef<HTMLInputElement>(null);
  const passphraseInputRef = useRef<HTMLInputElement>(null);

  // Single decision point for where an authenticated visitor belongs. Both a
  // fresh sign-in and someone opening /login while already signed in land here,
  // so the routing rules only exist once.
  useEffect(() => {
    if (!isAuthenticated || configLoading) return;
    // The restore step is a destination in its own right — don't route away.
    if (step === 'restore') return;

    // This device already holds a budget. Never pull automatically, because
    // restoring replaces every local table; that stays a deliberate choice in
    // Settings.
    if (isInitialized) {
      navigate('/settings', { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      let hasVault = false;
      try {
        const metadata = await api.vault.getMetadata();
        hasVault = metadata.version > 0;
      } catch {
        hasVault = false;
      }
      if (cancelled) return;

      if (hasVault) {
        setSearchParams(
          { step: 'restore', email: user?.email ?? emailParam },
          { replace: true },
        );
      } else {
        // Signed in but nothing to restore: send them through first-run setup
        // rather than into the app shell, which would bounce them straight
        // back to the landing page.
        navigate('/?setup=1', { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    configLoading,
    isInitialized,
    step,
    navigate,
    setSearchParams,
    user?.email,
    emailParam,
  ]);

  // Auto-focus the input that the current step is asking for
  useEffect(() => {
    if (step === 'verify') {
      codeInputRef.current?.focus();
    } else if (step === 'restore') {
      passphraseInputRef.current?.focus();
    }
  }, [step]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await login(trimmed);
      setSearchParams({ step: 'verify', email: trimmed });
      setResendCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6 || !/^\d{6}$/.test(trimmedCode)) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      await verify(emailParam, trimmedCode, rememberMe);
      // Deliberately stay in the loading state: the effect above decides where
      // to send them once the session is live.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.');
      setLoading(false);
    }
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passphrase) {
      setError('Please enter your encryption passphrase.');
      return;
    }

    setLoading(true);
    try {
      setPassphrase(passphrase);
      await pull();
      // pull() marks the database as initialised, so the app shell will now
      // render instead of redirecting to the landing page.
      navigate('/cash-flow', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore your data.');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setLoading(true);
    try {
      await login(emailParam);
      setResendCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  const goBackToEmail = () => {
    setSearchParams({});
    setCode('');
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg">
        {step === 'restore' ? (
          /* Step 3: Restore an existing vault onto a device with no local data */
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full bg-blue-500/10 p-3">
                <KeyRound className="h-6 w-6 text-blue-500" />
              </div>
              <h1 className="text-2xl font-bold">Restore your budget</h1>
              <p className="mt-2 text-muted-foreground">
                You have a synced budget, but nothing on this device yet. Enter your encryption
                passphrase to bring it back.
              </p>
            </div>

            <form onSubmit={handleRestore} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="passphrase" className="text-sm font-medium">
                  Encryption passphrase
                </label>
                <Input
                  ref={passphraseInputRef}
                  id="passphrase"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphraseInput(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    Restore my budget
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <Alert>
              Your passphrase never leaves this device. Without it, nobody — including us — can
              read your vault.
            </Alert>

            <div className="text-center">
              <Link
                to="/?setup=1"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Set up fresh on this device instead
              </Link>
            </div>
          </div>
        ) : step === 'verify' ? (
          /* Step 2: Code Verification */
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full bg-blue-500/10 p-3">
                <Mail className="h-6 w-6 text-blue-500" />
              </div>
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="mt-2 text-muted-foreground">
                We sent a 6-digit code to{' '}
                <span className="font-medium text-foreground">{emailParam}</span>
              </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="code" className="text-sm font-medium">
                  Enter code
                </label>
                <Input
                  ref={codeInputRef}
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-lg tracking-widest"
                  autoComplete="one-time-code"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <label htmlFor="remember-me" className="cursor-pointer text-sm text-muted-foreground">
                  Remember me for 30 days
                </label>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="text-center text-sm">
              <p className="text-muted-foreground">
                Didn&apos;t receive it?{' '}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                >
                  {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                </button>
              </p>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={goBackToEmail}
                className="inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          /* Step 1: Email */
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full bg-blue-500/10 p-3">
                <Cloud className="h-6 w-6 text-blue-500" />
              </div>
              <h1 className="text-2xl font-bold">Cloud Sync</h1>
              <p className="mt-2 text-muted-foreground">
                Sign in to sync your budget across devices.
              </p>
            </div>

            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send login code
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <Alert>
              Your financial data is encrypted on your device. We never see your budget.
            </Alert>

            <div className="text-center">
              {/* Before setup there is no app to go back to — /cash-flow would
                  bounce off the RootLayout guard. */}
              <Link
                to={isInitialized ? '/cash-flow' : '/welcome'}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                {isInitialized ? 'Back to app' : 'Back to home'}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
