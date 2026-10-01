import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Cloud, Loader2 } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Where both branches start. Nothing here reveals whether the address already
 * has an account — the server answers the same way either way, and the flow
 * only forks after the code has been entered.
 *
 * In `invite` mode the copy cannot name the sender: there is no unauthenticated
 * token lookup, deliberately, so this page knows only that an invite exists.
 * What it can do is warn that the invite is bound to its address. The server
 * only checks that at the very end, after the code, the password and the
 * recovery phrase, so this is the one place to say it early.
 */
export function EmailStep({
  mode = 'account',
  initialEmail,
  onSubmit,
  loading,
  error,
  backTo,
  backLabel,
}: {
  mode?: 'account' | 'invite';
  initialEmail: string;
  onSubmit: (email: string) => void;
  loading: boolean;
  error: string | null;
  backTo: string;
  backLabel: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [validationError, setValidationError] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError(null);

    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setValidationError('Please enter a valid email address.');
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 rounded-full bg-blue-500/10 p-3">
          <Cloud className="h-6 w-6 text-blue-500" />
        </div>
        <h1 className="text-2xl font-bold">
          {mode === 'account' ? 'Cloud sync' : 'You have been invited'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {mode === 'account' ? (
            <>
              Sync your budget across devices, and share it with a partner. Start by confirming your
              email address.
            </>
          ) : (
            <>
              Someone has invited you to share their budget. Enter the email address the invite was
              sent to. It will not work with any other address.
            </>
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email address
          </label>
          <Input
            ref={emailInputRef}
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
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
              Sending...
            </>
          ) : (
            <>
              Send me a code
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <Alert>
        Your budget is encrypted on this device before it is uploaded. The server stores locked
        boxes and never holds a key to them.
      </Alert>

      <div className="text-center">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
