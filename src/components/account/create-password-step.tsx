import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { MINIMUM_PASSWORD_LENGTH } from '@/lib/account';

/**
 * Choose the password that will wrap the keys to the cloud vault.
 *
 * The copy carries the weight that a strength meter would: `zxcvbn` is
 * deferred rather than rejected (`crypto-design.md` section 8), so the floor is
 * a length and the advice is to let a password manager generate one.
 *
 * What this password is *not* is a lock on the data sitting in this browser.
 * Nothing here should imply otherwise — the device copy is plaintext on disk
 * and stays that way (threat model, property 5).
 */
export function CreatePasswordStep({
  onSubmit,
  onBack,
  loading,
  error,
}: {
  onSubmit: (password: string) => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passwordInputRef.current?.focus();
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError(null);

    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      setValidationError(`Your password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setValidationError('Those two passwords do not match.');
      return;
    }

    onSubmit(password);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 rounded-full bg-blue-500/10 p-3">
          <KeyRound className="h-6 w-6 text-blue-500" />
        </div>
        <h1 className="text-2xl font-bold">Choose a password</h1>
        <p className="mt-2 text-muted-foreground">
          This password encrypts your budget before it leaves this device. Nobody can read your
          cloud copy without it — not me, not anyone.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="new-password" className="text-sm font-medium">
            Password
          </label>
          <div className="relative">
            <Input
              ref={passwordInputRef}
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
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
          <p className="text-sm text-muted-foreground">
            At least {MINIMUM_PASSWORD_LENGTH} characters. Let your password manager generate one
            and store it — you will need it on every device you sync to.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm-new-password" className="text-sm font-medium">
            Confirm password
          </label>
          <Input
            id="confirm-new-password"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
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
              Working...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <Alert>
        The budget already on this device becomes the first thing you sync. Anyone you later invite
        to your household will be able to read it.
      </Alert>

      <div className="text-center">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="cursor-pointer text-sm text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"
        >
          Use a different email
        </button>
      </div>
    </div>
  );
}
