import { ArrowLeft, ArrowRight, Loader2, MailOpen } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import type { InviteView } from '@/lib/invite-acceptance';

const HEADINGS: Record<InviteView['kind'], string> = {
  checking: 'Checking your invite',
  'check-failed': 'We could not check your invite',
  'can-accept': 'Join a shared budget',
  'has-household': 'This account already has a budget',
  'wrong-account': 'This invite is for a different address',
  unusable: 'This invite cannot be used',
};

export function InviteStatusStep({
  view,
  signedInEmail,
  onAccept,
  onRetry,
  onSignOut,
  settingsReachable,
  loading,
  error,
}: {
  view: InviteView;
  /** Null once an invite signup has failed: there is no account to sign out of. */
  signedInEmail: string | null;
  onAccept: () => void;
  onRetry: () => void;
  onSignOut: () => void;
  /** Settings sits behind the setup guard, so a device with no budget cannot link to it. */
  settingsReachable: boolean;
  loading: boolean;
  error: string | null;
}) {
  const signedInAs = signedInEmail && (
    <span className="font-medium text-foreground">{signedInEmail}</span>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 rounded-full bg-blue-500/10 p-3">
          <MailOpen className="h-6 w-6 text-blue-500" />
        </div>
        <h1 className="text-2xl font-bold">{HEADINGS[view.kind]}</h1>
      </div>

      <div className="space-y-3 text-center text-muted-foreground">
        {view.kind === 'checking' && (
          <p className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            One moment...
          </p>
        )}

        {view.kind === 'check-failed' && (
          <p>
            You are signed in as {signedInAs}, but we could not reach the server to check this
            account against the invite. Try again in a moment.
          </p>
        )}

        {view.kind === 'can-accept' && (
          <p>
            You are signed in as {signedInAs}. Accepting joins you to the household this invite came
            from. The person who invited you then approves you, and after that you share one budget.
          </p>
        )}

        {view.kind === 'has-household' && (
          <>
            <p>
              You are signed in as {signedInAs}, and that account already has its own household. An
              account can belong to only one, and it cannot move to another.
            </p>
            <p>
              To join this one, delete this account in{' '}
              {settingsReachable ? (
                <Link to="/settings" className="underline underline-offset-4 hover:text-foreground">
                  Settings
                </Link>
              ) : (
                'Settings'
              )}
              , then open the invite link again.
            </p>
            <p>
              To share the budget on this account instead, the person who invited you would need to
              delete theirs and accept an invite from you.
            </p>
            <p>If this is not your account, sign out and open the link again.</p>
          </>
        )}

        {view.kind === 'wrong-account' && (
          <p>
            You are signed in as {signedInAs}, but this invite was sent to a different address. If
            it is meant for someone else using this device, sign out and let them open the link. If
            it is meant for you, sign out and sign in with the address the invite was sent to.
          </p>
        )}

        {view.kind === 'unusable' && <p>{view.message}</p>}
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {view.kind === 'can-accept' && (
        <Button className="w-full cursor-pointer" onClick={onAccept} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Accepting...
            </>
          ) : (
            <>
              Accept invite
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      )}

      {view.kind === 'check-failed' && (
        <Button className="w-full cursor-pointer" onClick={onRetry} disabled={loading}>
          Try again
        </Button>
      )}

      <div className="space-y-2 text-center">
        {signedInEmail && view.kind !== 'checking' && (
          <div>
            <button
              type="button"
              onClick={onSignOut}
              disabled={loading}
              className="cursor-pointer text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:cursor-not-allowed"
            >
              Sign out
            </button>
          </div>
        )}
        {!signedInEmail && (
          <div>
            <Link
              to="/welcome"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
