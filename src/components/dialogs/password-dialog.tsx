import { useState } from 'react';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
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
 * Collects the account password that unlocks the cloud vault.
 *
 * Under the wrapped-key scheme there is no separate vault passphrase: the
 * account password derives KEK_pwd, which unwraps the MasterKey. The wording
 * here says "password" throughout for that reason — a second name for the
 * same secret is the fastest way to make people think there are two.
 */
interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'unlock';
  onSubmit: (password: string) => void;
  error?: string | null;
  loading?: boolean;
}

const MINIMUM_PASSWORD_LENGTH = 8;

export function PasswordDialog({
  open,
  onOpenChange,
  mode,
  onSubmit,
  error,
  loading,
}: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      setValidationError(`Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (mode === 'create' && password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    onSubmit(password);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPassword('');
      setConfirmPassword('');
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
          <DialogTitle>{mode === 'create' ? 'Create Vault Password' : 'Unlock Vault'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'This password encrypts your data. It never leaves your device.'
              : 'Enter your password to sync.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'create' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  If you forget this password, your cloud data cannot be recovered. Write it down.
                </p>
              </div>
            </div>
          )}

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
                autoFocus
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {mode === 'create' && (
            <div className="space-y-2">
              <label htmlFor="confirm-vault-password" className="text-sm font-medium">
                Confirm password
              </label>
              <Input
                id="confirm-vault-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
              />
            </div>
          )}

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
              {mode === 'create' ? 'Create & Push' : 'Unlock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
