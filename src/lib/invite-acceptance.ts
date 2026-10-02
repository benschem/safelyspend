import { ApiError, type KeyBundle, type ReceivedInvite } from '@/lib/api-client';

/**
 * Where an invitee goes once they have an account attached to an invite and
 * are waiting for the other member to hand them the household key. Step 4 of
 * `docs/auth-rewrite/07_invite_flow.md` builds the screen; until then the route
 * is a placeholder.
 */
export const WAITING_FOR_HANDOFF_PATH = '/household/waiting';

/**
 * Every screen an invite link can end on short of the waiting screen, rendered
 * by `InviteStatusStep`.
 *
 * Two types below feed it, which is why their kinds share its names:
 * `SignedInInviteState` for the read-only check, and `AcceptFailure` for a
 * refused accept or invite signup. `wrong-account` is what a `wrong-address`
 * failure becomes while signed in.
 *
 * `checking` and `check-failed` are the read-only lookup that decides between
 * the others; `can-accept` is the only view with an Accept button. Everything
 * else is a dead end, and every dead end reached while signed in offers sign
 * out, because the likeliest cause is a shared device signed in as the wrong
 * person.
 */
export type InviteView =
  | { kind: 'checking' }
  | { kind: 'check-failed' }
  | { kind: 'can-accept' }
  | { kind: 'has-household' }
  | { kind: 'wrong-account' }
  | { kind: 'unusable'; message: string };

/** An `/accept-invite` link that arrived with its token cut off. */
export const BROKEN_INVITE_LINK_VIEW: InviteView = {
  kind: 'unusable',
  message:
    'This invite link is incomplete. Open it again from the email, making sure you use the whole link.',
};

/**
 * How far an account is through joining a household, read from the member key
 * rows in its key bundle and nothing else:
 *
 * - `awaiting-handoff`: no row. Nobody has handed this account a household key.
 * - `ready-to-join`: a lone `ecies` row. The key has been handed over, and the
 *   account has not yet rewrapped it under its own password and phrase.
 * - `member`: a `pwd` row. The password opens the household key.
 *
 * `household` is deliberately not consulted. The worker attaches the household
 * at the handoff, so it is already set in `ready-to-join`, where the password
 * still opens nothing. Reading it as "is a member" is how that state gets sent
 * to an unlock prompt that can only fail.
 */
export type HandoffState = 'awaiting-handoff' | 'ready-to-join' | 'member';

export function classifyHandoffState(bundle: KeyBundle): HandoffState {
  if (bundle.memberKeys.some((row) => row.kekKind === 'pwd')) return 'member';
  if (bundle.memberKeys.some((row) => row.kekKind === 'ecies')) return 'ready-to-join';
  return 'awaiting-handoff';
}

/**
 * Where a signed-in visitor holding an invite link stands, worked out without
 * calling accept.
 *
 * Accept is limited to three calls an hour per user, so it is never spent on
 * finding out. The key bundle says how far the account is through joining
 * (`classifyHandoffState`), and the received list says whether it has already
 * claimed an invite: the worker's `listReceived` returns only invites whose
 * `recipient_user_id` is this account, so an unclaimed one never appears in it.
 *
 * An account handed a key it has not rewrapped belongs on the waiting screen,
 * which is where it finishes joining.
 *
 * An account with no key at all is not proof that it is waiting. Two states
 * leave one attached to no live invite: the claim failing after
 * `signup-with-invite` created the account, and the invite it claimed being
 * revoked and re-sent (revoke-then-send is how v1 re-sends). Both need the
 * Accept button, and routing them to the waiting screen would strand them there.
 */
export type SignedInInviteState = 'has-household' | 'waiting' | 'can-accept';

export function classifySignedInInvitee(
  bundle: KeyBundle,
  received: ReceivedInvite[],
): SignedInInviteState {
  switch (classifyHandoffState(bundle)) {
    case 'member':
      return 'has-household';
    case 'ready-to-join':
      return 'waiting';
    case 'awaiting-handoff': {
      const hasLiveClaim = received.some((invite) => invite.status === 'accepted_pending_handoff');
      return hasLiveClaim ? 'waiting' : 'can-accept';
    }
  }
}

/**
 * What a refused accept or invite signup means for the screen, by the worker's
 * error code (`assertAcceptable` in `worker/src/services/invites.ts`).
 *
 * Only for those two calls. Issuing an invite answers `HOUSEHOLD_FULL` too,
 * meaning the sender's household is full rather than that the caller has one.
 *
 * The address mismatch carries no sentence here, because the right one
 * depends on the caller: signed out, the fix is typing a different address;
 * signed in, it is signing out.
 */
export type AcceptFailure =
  | { kind: 'wrong-address' }
  | { kind: 'has-household' }
  | { kind: 'unusable'; message: string }
  | { kind: 'rate-limited' }
  | { kind: 'other' };

export function classifyAcceptFailure(err: unknown): AcceptFailure {
  if (!(err instanceof ApiError)) return { kind: 'other' };

  switch (err.data?.['code']) {
    case 'EMAIL_MISMATCH':
      return { kind: 'wrong-address' };
    case 'HOUSEHOLD_FULL':
      return { kind: 'has-household' };
    case 'INVALID_INVITE':
      return {
        kind: 'unusable',
        message:
          'This invite link is not valid. Check that you opened the whole link from the email, or ask for a new invite.',
      };
    case 'INVITE_EXPIRED':
      return {
        kind: 'unusable',
        message: 'This invite has expired. Ask the person who sent it to send you a new one.',
      };
    // The worker answers a revoked invite with this code too, so the sentence
    // cannot claim it was used. Expiry has its own code and never lands here.
    case 'INVITE_ALREADY_ACCEPTED':
      return {
        kind: 'unusable',
        message:
          'This invite is no longer open. It may have been cancelled, or already used. Ask the person who sent it to send you a new one.',
      };
  }

  return err.status === 429 ? { kind: 'rate-limited' } : { kind: 'other' };
}
