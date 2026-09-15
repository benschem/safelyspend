import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

/**
 * Prompts for the account password to unlock this session's key vault.
 *
 * Under the wrapped-key scheme there is no separate vault passphrase: the
 * account password derives KEK_pwd, which unwraps the MasterKey. The wording
 * says "password" throughout for that reason — a second name for the same
 * secret is the fastest way to make people think there are two.
 *
 * There used to be a `create` mode here too. The password is collected in the
 * signup flow now (`src/routes/login.tsx`), so that mode had no caller, and its
 * warning — "if you forget this password, your cloud data cannot be recovered"
 * — became false the moment the recovery phrase shipped. It was deleted rather
 * than rewritten: a mode with no call site is exactly the thing that gets
 * resurrected later with its stale copy intact.
 */
interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (password: string) => void;
  error?: string | null;
  loading?: boolean;
}

export function PasswordDialog({
  open,
  onOpenChange,
  onSubmit,
  error,
  loading,
}: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // No length floor here. This is an existing password, chosen under whatever
    // rule was in force at the time; rejecting it would lock an account out
    // rather than protect it.
    if (!password) {
      setValidationError('Please enter your password.');
      return;
    }

    onSubmit(password);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPassword('');
      setShowPassword(false);
      setValidationError(null);
    }
    onOpenChange(nextOpen);
  };

  const displayError = validationError ?? error;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Unlock your vault</DialogTitle>
          <DialogDescription>
            Enter your account password to push and pull your budget.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="vault-password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <Input
                id="vault-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                autoFocus
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

          {displayError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {displayError}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="cursor-pointer">
              Unlock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
