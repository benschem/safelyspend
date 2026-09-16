import { useEffect, useRef, useState } from 'react';
import { ArrowRight, LifeBuoy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import {
  isValidRecoveryPhrase,
  normaliseRecoveryPhraseInput,
  RECOVERY_PHRASE_WORD_COUNT,
} from '@/lib/key-management';

/**
 * The other end of `RecoveryPhraseStep`: typing the twelve words back in.
 *
 * A textarea rather than twelve inputs, because the phrase was almost certainly
 * stored in a password manager as one string and pasting it is the path that
 * works. Twelve boxes would turn a paste into twelve manual moves.
 *
 * ## Why this validates before submitting
 *
 * The phrase is checked here *and* in `unlockKeyBundleWithPhrase`, which is not
 * duplication. Submitting spends the bridge token — the same one-shot rule as a
 * wrong password on the sign-in step — so a mistyped word caught here saves the
 * user a round trip to their inbox for a fresh code. BIP-39's checksum makes
 * that check exact rather than a guess: a single wrong word fails it.
 *
 * What it cannot catch is a phrase that is perfectly valid and belongs to a
 * different account. That one costs a code, and there is no way it could not.
 */
export function RecoveryPhraseEntryStep({
  onSubmit,
  onBack,
  loading,
  error,
}: {
  onSubmit: (phrase: string) => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [phrase, setPhrase] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const phraseInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    phraseInputRef.current?.focus();
  }, []);

  // Tidied before anything else sees it — including the word count, so that
  // stray whitespace never reads back as an extra word.
  const normalised = normaliseRecoveryPhraseInput(phrase);
  const wordCount = normalised ? normalised.split(' ').length : 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError(null);

    if (wordCount !== RECOVERY_PHRASE_WORD_COUNT) {
      setValidationError(
        `A recovery phrase is ${RECOVERY_PHRASE_WORD_COUNT} words. You have entered ${wordCount}.`,
      );
      return;
    }
    if (!isValidRecoveryPhrase(normalised)) {
      setValidationError(
        'Those twelve words do not form a valid recovery phrase. Check for a mistyped or swapped word.',
      );
      return;
    }

    onSubmit(normalised);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 rounded-full bg-emerald-500/10 p-3">
          <LifeBuoy className="h-6 w-6 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold">Enter your recovery phrase</h1>
        <p className="mt-2 text-muted-foreground">
          The twelve words you saved when you set up syncing. They will let you choose a new
          password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="recovery-phrase" className="text-sm font-medium">
            Recovery phrase
          </label>
          <Textarea
            ref={phraseInputRef}
            id="recovery-phrase"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            rows={3}
            placeholder="twelve words, separated by spaces"
            // A password manager holds this, not the browser, so there is no
            // autofill worth offering — and every one of these off switches is
            // a way a phone could quietly corrupt the words.
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            error={Boolean(validationError ?? error)}
            className="font-mono"
          />
          <p className="text-sm text-muted-foreground">
            {wordCount === RECOVERY_PHRASE_WORD_COUNT
              ? 'Twelve words.'
              : `${wordCount} of ${RECOVERY_PHRASE_WORD_COUNT} words.`}
          </p>
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
              Checking your phrase...
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
        Your phrase never leaves this device. It unwraps your keys here, in this browser. The server
        only ever sees the new password you choose next.
      </Alert>

      <div className="text-center">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="cursor-pointer text-sm text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"
        >
          I remember my password after all
        </button>
      </div>
    </div>
  );
}
