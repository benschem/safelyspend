import { useState } from 'react';
import { ArrowRight, Check, Copy, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * The recovery phrase moment (overview Q1): display, a copy-to-password-manager
 * button, and an acknowledgement checkbox with no way past it.
 *
 * This step cannot be skipped or deferred, and that is not a UX preference.
 * `/auth/signup` rejects a payload that does not carry the recovery-wrapped
 * rows alongside the password-wrapped ones
 * (`worker/src/lib/key-material.ts:263`), so the phrase has to exist and be
 * acknowledged before the account does. The window in which an account exists
 * and cannot be recovered never opens.
 *
 * The phrase lives in the parent's state for the length of this step and is
 * dropped when the step unmounts. It is never written to `sessionStorage`, to
 * the URL, or to the server — after this screen the only copy is wherever the
 * user put it.
 */
export function RecoveryPhraseStep({
  phrase,
  onAcknowledge,
  loading,
  error,
}: {
  phrase: string;
  onAcknowledge: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const words = phrase.split(' ');

  const handleCopy = async () => {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(phrase);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused outside a secure context and in some
      // browser configurations. The words are on screen either way, so say so
      // rather than leaving a button that silently does nothing.
      setCopyFailed(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 rounded-full bg-emerald-500/10 p-3">
          <ShieldCheck className="h-6 w-6 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold">Save your recovery phrase</h1>
        <p className="mt-2 text-muted-foreground">
          These twelve words are the only way back into your budget if you forget your password.
          They are shown once and never again.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <ol className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {words.map((word, index) => (
            <li key={`${index}-${word}`} className="flex items-baseline gap-2 text-sm">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span className="font-mono font-medium">{word}</span>
            </li>
          ))}
        </ol>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleCopy}
        className="w-full cursor-pointer"
        disabled={loading}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy to your password manager
          </>
        )}
      </Button>

      {copyFailed && (
        <p className="text-sm text-muted-foreground">
          This browser would not let the page use the clipboard. Copy the words above by hand.
        </p>
      )}

      <Alert>
        Store them somewhere only you can reach. Anyone who has both these words and a copy of your
        encrypted vault can read your budget.
      </Alert>

      <div className="flex items-start gap-2">
        <Checkbox
          id="recovery-acknowledged"
          checked={acknowledged}
          onCheckedChange={(checked) => setAcknowledged(checked === true)}
          disabled={loading}
        />
        <label htmlFor="recovery-acknowledged" className="cursor-pointer text-sm">
          I have saved my recovery phrase. I understand that if I lose both it and my password, my
          budget cannot be recovered by anyone.
        </label>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Button
        type="button"
        onClick={onAcknowledge}
        className="w-full cursor-pointer"
        disabled={!acknowledged || loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating your account...
          </>
        ) : (
          <>
            Create my account
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}
