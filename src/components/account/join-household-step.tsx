import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Download, Eye, EyeOff, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import {
  isValidRecoveryPhrase,
  normaliseRecoveryPhraseInput,
  RECOVERY_PHRASE_WORD_COUNT,
} from '@/lib/key-management';

/**
 * The last step of joining a household: password and recovery phrase, after
 * the safety numbers have been confirmed.
 *
 * The phrase is asked for again because nothing kept it since signup, and the
 * rewrap needs it (decided 2026-09-16; `completeHandoff` in `account.ts` says why).
 *
 * Joining replaces the budget on this device with the household's, so the
 * screen always warns and always offers a backup first. It cannot tell
 * whether there is anything here to lose; `docs/work/sync-prompt.md` has the
 * version that only asks when there is.
 *
 * The phrase is checked against BIP-39 here before submitting, as
 * `RecoveryPhraseEntryStep` does. Nothing is spent by a wrong one here, since
 * `completeHandoff` proves both credentials locally before any upload, but the
 * form can say something sharper about a mistyped word than "did not unlock".
 */
export function JoinHouseholdStep({
  senderEmail,
  onJoin,
  onDownloadBackup,
  joining,
  error,
}: {
  senderEmail: string | null;
  onJoin: (password: string, recoveryPhrase: string) => void;
  onDownloadBackup: () => void;
  joining: boolean;
  error: string | null;
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passwordInputRef.current?.focus();
  }, []);

  // Tidied before anything else sees it, including the word count, so that
  // stray whitespace never reads back as an extra word.
  const normalisedPhrase = normaliseRecoveryPhraseInput(phrase);
  const wordCount = normalisedPhrase ? normalisedPhrase.split(' ').length : 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError(null);

    if (!password) {
      setValidationError('Please enter your password.');
      return;
    }
    if (wordCount !== RECOVERY_PHRASE_WORD_COUNT) {
      setValidationError(
        `A recovery phrase is ${RECOVERY_PHRASE_WORD_COUNT} words. You have entered ${wordCount}.`,
      );
      return;
    }
    if (!isValidRecoveryPhrase(normalisedPhrase)) {
      setValidationError(
        `Those ${RECOVERY_PHRASE_WORD_COUNT} words do not form a valid recovery phrase. Check for a mistyped or swapped word.`,
      );
      return;
    }

    onJoin(password, normalisedPhrase);
  };

  const shownError = validationError ?? error;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 rounded-full bg-emerald-500/10 p-3">
          <Users className="h-6 w-6 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold">Join the shared budget</h1>
        <p className="mt-2 text-muted-foreground">
          {senderEmail ? (
            <>
              Enter your password and recovery phrase to join{' '}
              <span className="font-medium text-foreground">{senderEmail}</span>.
            </>
          ) : (
            'Enter your password and recovery phrase to join.'
          )}
        </p>
      </div>

      <Alert variant="warning">
        <p>
          Joining replaces any budget on this device with the shared one. If you have anything here
          you want to keep, download a backup first. The file is not encrypted, so keep it somewhere
          safe.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={onDownloadBackup}
          disabled={joining}
        >
          <Download className="h-4 w-4" />
          Download a backup
        </Button>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="join-password" className="text-sm font-medium">
            Password
          </label>
          <div className="relative">
            <Input
              ref={passwordInputRef}
              id="join-password"
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

        <div className="space-y-2">
          <label htmlFor="join-recovery-phrase" className="text-sm font-medium">
            Recovery phrase
          </label>
          <Textarea
            id="join-recovery-phrase"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            rows={3}
            placeholder={`the ${RECOVERY_PHRASE_WORD_COUNT} words you saved when you signed up`}
            // Every one of these off switches is a way a phone could quietly
            // corrupt the words, as in `RecoveryPhraseEntryStep`.
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="font-mono"
          />
          <p className="text-sm text-muted-foreground">
            {wordCount === RECOVERY_PHRASE_WORD_COUNT
              ? `${RECOVERY_PHRASE_WORD_COUNT} words.`
              : `${wordCount} of ${RECOVERY_PHRASE_WORD_COUNT} words.`}
          </p>
        </div>

        {shownError && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {shownError}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={joining}>
          {joining ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Joining...
            </>
          ) : (
            <>
              Join
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
