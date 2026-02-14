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

interface PassphraseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'unlock';
  onSubmit: (passphrase: string) => void;
  error?: string | null;
  loading?: boolean;
}

export function PassphraseDialog({
  open,
  onOpenChange,
  mode,
  onSubmit,
  error,
  loading,
}: PassphraseDialogProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (passphrase.length < 8) {
      setValidationError('Passphrase must be at least 8 characters.');
      return;
    }

    if (mode === 'create' && passphrase !== confirmPassphrase) {
      setValidationError('Passphrases do not match.');
      return;
    }

    onSubmit(passphrase);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPassphrase('');
      setConfirmPassphrase('');
      setShowPassphrase(false);
      setValidationError(null);
    }
    onOpenChange(nextOpen);
  };

  const displayError = validationError ?? error;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create Vault Passphrase' : 'Unlock Vault'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'This passphrase encrypts your data. It never leaves your device.'
              : 'Enter your passphrase to sync.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'create' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  If you forget this passphrase, your cloud data cannot be recovered. Write it down.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="passphrase" className="text-sm font-medium">
              Passphrase
            </label>
            <div className="relative">
              <Input
                id="passphrase"
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter passphrase"
                autoFocus
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassphrase ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {mode === 'create' && (
            <div className="space-y-2">
              <label htmlFor="confirm-passphrase" className="text-sm font-medium">
                Confirm passphrase
              </label>
              <Input
                id="confirm-passphrase"
                type={showPassphrase ? 'text' : 'password'}
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Confirm passphrase"
              />
            </div>
          )}

          {displayError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {displayError}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
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
