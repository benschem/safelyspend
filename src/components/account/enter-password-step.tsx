import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * The password prompt for someone who already has an account.
 *
 * No confirm field and no length floor: the password was chosen under whatever
 * rule was in force when the account was made, and re-enforcing today's floor
 * here would lock out an account rather than protect it.
 *
 * Two modes, because there are two ways to arrive holding no MasterKey and
 * they differ in what a wrong password costs:
 *
 * - `sign-in` — no session yet. The password is proved to the server, which
 *   spends the bridge token doing it. There is no second attempt on this
 *   screen; a mistake sends the user back for a fresh code. Phase 1 section 3.3
 *   makes that deliberate, so the copy has to make it predictable.
 * - `unlock` — the session is already live and the password only has to open
 *   the wrapped rows locally. Nothing is spent, so wrong guesses are free and
 *   the session length is not this screen's to decide.
 */
export function EnterPasswordStep({
  mode,
  email,
  onSubmit,
  onBack,
  loading,
  error,
}: {
  mode: 'sign-in' | 'unlock';
  email: string;
  onSubmit: (password: string, rememberMe: boolean) => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passwordInputRef.current?.focus();
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError(null);

    if (!password) {
      setValidationError('Please enter your password.');
      return;
    }
    onSubmit(password, rememberMe);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 rounded-full bg-blue-500/10 p-3">
          <LockKeyhole className="h-6 w-6 text-blue-500" />
        </div>
        <h1 className="text-2xl font-bold">
          {mode === 'sign-in' ? 'Enter your password' : 'Restore your budget'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {mode === 'sign-in' ? (
            <>
              Signing in as <span className="font-medium text-foreground">{email}</span>
            </>
          ) : (
            <>
              You have a synced budget but nothing on this device yet. Enter your password to bring
              it back.
            </>
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="account-password" className="text-sm font-medium">
            Password
          </label>
          <div className="relative">
            <Input
              ref={passwordInputRef}
              id="account-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mode === 'sign-in' && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <label htmlFor="remember-me" className="cursor-pointer text-sm text-muted-foreground">
              Keep me signed in for 30 days
            </label>
          </div>
        )}

        {(validationError ?? error) && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {validationError ?? error}
          </div>
        )}

        <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {mode === 'sign-in' ? 'Signing in...' : 'Restoring...'}
            </>
          ) : (
            <>
              {mode === 'sign-in' ? 'Sign in' : 'Restore my budget'}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <Alert>
        {mode === 'sign-in'
          ? 'Your code has already been used. If this password is wrong, you will need a fresh one.'
          : 'Your password never leaves this device. Without it, nobody can read your vault — not me, not anyone.'}
      </Alert>

      <div className="text-center">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="cursor-pointer text-sm text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"
        >
          {mode === 'sign-in' ? 'Use a different email' : 'Set up fresh on this device instead'}
        </button>
      </div>
    </div>
  );
}
