import { ApiError, type SentInvite } from '@/lib/api-client';
import { isValidEmailAddress, normaliseEmailAddress } from '@/lib/email-address';

/**
 * Where an invite stands, as the member who sent it sees it:
 *
 * - `pending`: sent and not yet used.
 * - `awaiting-approval`: the recipient has made their account and is waiting
 *   for this member to hand them the household key.
 * - `expired`: timed out before anyone used it.
 * - `joined`: the recipient is in the household.
 * - `hidden`: revoked or declined. Nothing to show and nothing to act on.
 */
export type SentInviteState = 'pending' | 'awaiting-approval' | 'expired' | 'joined' | 'hidden';

/**
 * The state of a sent invite at a given moment.
 *
 * The worker's `status` is not enough for an `open` invite. Its expiry sweep
 * runs only when someone logs in, so a timed-out invite can keep saying `open`
 * long after every worker check has stopped honouring it. The clock decides,
 * by the same rule as `assertAcceptable` in `worker/src/services/invites.ts`.
 *
 * `accepted_pending_handoff` is not checked against the clock. The worker
 * deliberately leaves a claimed invite alone past its expiry, and the handoff
 * does not look at the date.
 */
export function sentInviteState(invite: SentInvite, now: Date): SentInviteState {
  switch (invite.status) {
    case 'open': {
      const hasLapsed = new Date(invite.expiresAt).getTime() <= now.getTime();
      return hasLapsed ? 'expired' : 'pending';
    }
    case 'accepted_pending_handoff':
      return 'awaiting-approval';
    case 'expired':
      return 'expired';
    case 'completed':
      return 'joined';
    case 'revoked':
    case 'declined':
      return 'hidden';
  }
}

export interface VisibleSentInvite {
  invite: SentInvite;
  state: Exclude<SentInviteState, 'hidden'>;
}

/** The sent invites worth a row, each with its state, in the order given. */
export function visibleSentInvites(sent: SentInvite[], now: Date): VisibleSentInvite[] {
  const visibleInvites: VisibleSentInvite[] = [];
  for (const invite of sent) {
    const state = sentInviteState(invite, now);
    if (state !== 'hidden') visibleInvites.push({ invite, state });
  }
  return visibleInvites;
}

/**
 * Whether an invite could still bring someone into the household.
 *
 * The send form is hidden while one can. A household holds two people, so a
 * second invite could only lose at the handoff, after its recipient had made
 * an account and saved a recovery phrase for nothing.
 */
export function hasLiveInvite(sent: SentInvite[], now: Date): boolean {
  return sent.some((invite) => {
    const state = sentInviteState(invite, now);
    return state === 'pending' || state === 'awaiting-approval';
  });
}

/** Why an address cannot be invited, found without spending a request. */
export type RecipientAddressProblem = 'not-an-address' | 'own-address';

/**
 * Check an address before issuing an invite to it. Both addresses are
 * normalised here, so either may be passed as typed or as stored.
 *
 * The worker accepts any non-empty string, and issuing is limited to five an
 * hour, so a typo caught here is the only place it is caught at all.
 */
export function recipientAddressProblem(
  recipientAddress: string,
  senderAddress: string,
): RecipientAddressProblem | null {
  const normalisedRecipient = normaliseEmailAddress(recipientAddress);
  if (!isValidEmailAddress(normalisedRecipient)) return 'not-an-address';
  if (normalisedRecipient === normaliseEmailAddress(senderAddress)) return 'own-address';
  return null;
}

/**
 * What a refused issue means for the send form, by the worker's answer to
 * `POST /v1/invites`.
 *
 * Separate from `classifyAcceptFailure` because `HOUSEHOLD_FULL` means
 * something else here: the sender's household already has two members, not
 * that the caller already belongs to one.
 *
 * - `household-full`: nobody else can be invited.
 * - `already-pending`: an open invite to this address exists, so the list on
 *   screen was stale. Re-reading it shows the invite.
 * - `rate-limited`: five an hour per user.
 */
export type IssueFailure =
  | { kind: 'household-full' }
  | { kind: 'already-pending' }
  | { kind: 'rate-limited' }
  | { kind: 'other' };

export function classifyIssueFailure(err: unknown): IssueFailure {
  if (!(err instanceof ApiError)) return { kind: 'other' };

  switch (err.data?.['code']) {
    case 'HOUSEHOLD_FULL':
      return { kind: 'household-full' };
    case 'INVITE_ALREADY_PENDING':
      return { kind: 'already-pending' };
  }

  return err.status === 429 ? { kind: 'rate-limited' } : { kind: 'other' };
}
