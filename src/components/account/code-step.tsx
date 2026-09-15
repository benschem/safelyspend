import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * The one-time code. Passing it is what earns the bridge token, and the token
 * is what the server's answer about this account rides on — so this is the step
 * where the flow learns whether it is a signup or a sign-in.
 */
export function CodeStep({
  email,
  onSubmit,
  onResend,
  onBack,
  loading,
  error,
}: {
  email: string;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [code, setCode] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    codeInputRef.current?.focus();
  }, []);

  // Keyed on whether a cooldown is running rather than on how much is left, so
  // one interval covers the whole countdown instead of being torn down and
  // rebuilt on every tick.
  const isCoolingDown = resendCooldown > 0;
  useEffect(() => {
    if (!isCoolingDown) return;
    const timer = window.setInterval(() => {
      setResendCooldown((previous) => Math.max(previous - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isCoolingDown]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError(null);

    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setValidationError('Please enter the six-digit code.');
      return;
    }
    onSubmit(trimmed);
  };

  const handleResend = () => {
    if (resendCooldown > 0 || loading) return;
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    onResend();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 rounded-full bg-blue-500/10 p-3">
          <Mail className="h-6 w-6 text-blue-500" />
        </div>
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="mt-2 text-muted-foreground">
          We sent a six-digit code to <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            className="text-center text-lg tracking-widest"
            autoComplete="one-time-code"
          />
        </div>

        {(validationError ?? error) && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {validationError ?? error}
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
          onClick={onBack}
          disabled={loading}
          className="inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"
        >
          <ArrowLeft className="h-3 w-3" />
          Use a different email
        </button>
      </div>
    </div>
  );
}
