import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useInvites } from '@/hooks/use-invites';
import { normaliseEmailAddress } from '@/lib/email-address';
import {
  hasLiveInvite,
  recipientAddressProblem,
  visibleSentInvites,
  type IssueFailure,
  type RecipientAddressProblem,
  type VisibleSentInvite,
} from '@/lib/invite-sending';
import { formatDate } from '@/lib/utils';

const ADDRESS_PROBLEM_WORDING: Record<RecipientAddressProblem, string> = {
  'not-an-address': 'Please enter a valid email address.',
  'own-address': 'That is your own address. Enter the address of the person you want to invite.',
};

const ISSUE_FAILURE_WORDING: Record<IssueFailure['kind'], string> = {
  'household-full': 'This budget is already shared by two people, so nobody else can be invited.',
  'already-pending': 'An invite to that address is already waiting. It is shown below.',
  'rate-limited': 'You have sent too many invites in the last hour. Wait an hour, then try again.',
  // Covers a dropped connection and a server error alike, so it claims neither.
  other: 'We could not send the invite. Please try again.',
};

const CANCEL_FAILURE_WORDING = 'We could not cancel the invite. Please try again.';

type InviteState = VisibleSentInvite['state'];

const STATE_BADGE: Record<
  InviteState,
  { label: string; variant: 'secondary' | 'warning' | 'outline' | 'success' }
> = {
  pending: { label: 'Invite sent', variant: 'secondary' },
  'awaiting-approval': { label: 'Waiting for you', variant: 'warning' },
  expired: { label: 'Expired', variant: 'outline' },
  joined: { label: 'Joined', variant: 'success' },
};

function describeInvite({ invite, state }: VisibleSentInvite): string {
  switch (state) {
    case 'pending':
      return `The link in their email works until ${formatDate(invite.expiresAt)}.`;
    case 'awaiting-approval':
      return 'They have created their account. You will be asked to approve them the next time you unlock your vault.';
    case 'expired':
      return `This invite expired on ${formatDate(invite.expiresAt)}.`;
    case 'joined':
      return 'Shares this budget with you.';
  }
}

/** An expired invite has nothing left to cancel, so its button only clears the row. */
const CANCEL_LABEL: Record<Exclude<InviteState, 'joined'>, string> = {
  pending: 'Cancel invite',
  'awaiting-approval': 'Cancel invite',
  expired: 'Remove',
};

/**
 * Where a member invites the one other person who can share their budget, and
 * sees or cancels what they have sent.
 *
 * A first cut: re-sending is Cancel, then Send. `docs/BACKLOG.md` lists what
 * was left out.
 *
 * The send form shows only while no invite is live (`hasLiveInvite`). It does
 * show beside a joined row, because a joined invite outlives its recipient
 * deleting their account: only the worker knows whether the household is full,
 * and says so when asked.
 *
 * Holds all of its own state, so it can be lifted out of Settings whole.
 */
export function HouseholdInvitesPanel({ senderEmail }: { senderEmail: string }) {
  const { sentInvitesLoad, retryLoad, send, cancel } = useInvites();
  const [recipientInput, setRecipientInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);
  // One action at a time, so a second click cannot spend a second request.
  const isActing = isSending || cancellingInviteId !== null;

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const addressProblem = recipientAddressProblem(recipientInput, senderEmail);
    if (addressProblem) {
      setError(ADDRESS_PROBLEM_WORDING[addressProblem]);
      return;
    }

    const recipientAddress = normaliseEmailAddress(recipientInput);
    setIsSending(true);
    const outcome = await send(recipientAddress);
    setIsSending(false);

    if (!outcome.ok) {
      setError(ISSUE_FAILURE_WORDING[outcome.failure.kind]);
      return;
    }
    setRecipientInput('');
    toast('Invite sent', { description: `We have emailed ${recipientAddress}.` });
  };

  const handleCancel = async (inviteId: string) => {
    setError(null);
    setCancellingInviteId(inviteId);
    const outcome = await cancel(inviteId);
    setCancellingInviteId(null);

    if (!outcome.ok) {
      setError(CANCEL_FAILURE_WORDING);
      return;
    }
    toast('Invite cancelled');
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Share this budget</h3>
      </div>

      {sentInvitesLoad.status === 'loading' && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {sentInvitesLoad.status === 'failed' && (
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">We could not load your invites.</p>
          <Button variant="outline" size="sm" onClick={retryLoad} className="cursor-pointer">
            Try again
          </Button>
        </div>
      )}

      {sentInvitesLoad.status === 'ready' && (
        <>
          {error && (
            <div className="p-4 pb-0">
              <Alert variant="destructive">{error}</Alert>
            </div>
          )}

          {!hasLiveInvite(sentInvitesLoad.sent, sentInvitesLoad.readAt) && (
            <form onSubmit={(event) => void handleSend(event)} noValidate className="space-y-3 p-4">
              {/* noValidate, so a bad address gets this panel's wording rather
                  than the browser's own bubble. The input stays type="email"
                  for the keyboard it brings up on a phone. */}
              <p className="text-sm text-muted-foreground">
                Invite one other person to share this budget. They will get an email with a link to
                create their own account.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <label htmlFor="invite-recipient-email" className="text-sm font-medium">
                    Their email address
                  </label>
                  <Input
                    id="invite-recipient-email"
                    type="email"
                    value={recipientInput}
                    onChange={(event) => setRecipientInput(event.target.value)}
                    autoComplete="off"
                    disabled={isActing}
                  />
                </div>
                <Button type="submit" disabled={isActing} className="cursor-pointer">
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send invite'
                  )}
                </Button>
              </div>
            </form>
          )}

          <SentInviteRows
            rows={visibleSentInvites(sentInvitesLoad.sent, sentInvitesLoad.readAt)}
            isActing={isActing}
            cancellingInviteId={cancellingInviteId}
            onCancel={(inviteId) => void handleCancel(inviteId)}
          />
        </>
      )}
    </div>
  );
}

function SentInviteRows({
  rows,
  isActing,
  cancellingInviteId,
  onCancel,
}: {
  rows: VisibleSentInvite[];
  isActing: boolean;
  cancellingInviteId: string | null;
  onCancel: (inviteId: string) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="divide-y border-t">
      {rows.map((row) => {
        const { invite, state } = row;
        const badge = STATE_BADGE[state];

        return (
          <div
            key={invite.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">{invite.recipientEmail}</span>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{describeInvite(row)}</p>
            </div>
            {state !== 'joined' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCancel(invite.id)}
                disabled={isActing}
                className="shrink-0 cursor-pointer"
              >
                {/* The label stays beside the spinner, so the button never
                    loses its name for a screen reader. */}
                {cancellingInviteId === invite.id && <Loader2 className="h-4 w-4 animate-spin" />}
                {CANCEL_LABEL[state]}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
