import { describe, it, expect } from 'vitest';
import {
  ApiError,
  type InviteStatus,
  type KekKind,
  type KeyBundle,
  type MemberKeyRow,
  type ReceivedInvite,
} from '@/lib/api-client';
import {
  classifyAcceptFailure,
  classifyHandoffState,
  classifySignedInInvitee,
} from '@/lib/invite-acceptance';

/**
 * A member key row of the given kind. The wrapped bytes are placeholders: the
 * classifiers read only `kekKind`, so nothing here needs to open.
 */
function memberKeyRow(kekKind: KekKind): MemberKeyRow {
  const isHandoffRow = kekKind === 'ecies';
  return {
    kekKind,
    kekSalt: null,
    kekKdfKind: null,
    kekKdfParams: null,
    wrappedMasterKey: 'wrapped-master-key',
    senderUserId: isHandoffRow ? 'sender-user' : null,
    senderPubkey: isHandoffRow ? 'sender-pubkey' : null,
  };
}

/** The household is attached at the handoff, so any bundle with rows has one. */
function keyBundle(memberKeys: MemberKeyRow[]): KeyBundle {
  return {
    user: {
      id: 'user-1',
      pubkey: 'user-pubkey',
      verifierSalt: 'verifier-salt',
      verifierKdfKind: 1,
      verifierKdfParams: 'verifier-params',
    },
    userKeys: [],
    household: memberKeys.length > 0 ? { id: 'household-1', name: 'Household' } : null,
    memberKeys,
  };
}

const AWAITING_HANDOFF_BUNDLE = keyBundle([]);
const READY_TO_JOIN_BUNDLE = keyBundle([memberKeyRow('ecies')]);
const MEMBER_BUNDLE = keyBundle([memberKeyRow('pwd'), memberKeyRow('recovery')]);

function receivedInvite(status: InviteStatus): ReceivedInvite {
  return {
    id: `invite-${status}`,
    senderEmail: 'sender@example.com',
    status,
    expiresAt: '2026-09-21T00:00:00.000Z',
    createdAt: '2026-09-18T00:00:00.000Z',
  };
}

function codedError(status: number, code: string) {
  return new ApiError('worker message', status, { error: 'worker message', code });
}

describe('classifyHandoffState', () => {
  it('is awaiting a handoff when the bundle holds no member key', () => {
    expect(classifyHandoffState(AWAITING_HANDOFF_BUNDLE)).toBe('awaiting-handoff');
  });

  it('is ready to join once a handoff row has arrived', () => {
    expect(classifyHandoffState(READY_TO_JOIN_BUNDLE)).toBe('ready-to-join');
  });

  it('is a member once a password row exists', () => {
    expect(classifyHandoffState(MEMBER_BUNDLE)).toBe('member');
  });

  it('does not treat a handed-over key as membership because the household is set', () => {
    expect(READY_TO_JOIN_BUNDLE.household).not.toBeNull();
    expect(classifyHandoffState(READY_TO_JOIN_BUNDLE)).not.toBe('member');
  });
});

describe('classifySignedInInvitee', () => {
  it('reports a household for a member, whatever the received list holds', () => {
    expect(classifySignedInInvitee(MEMBER_BUNDLE, [])).toBe('has-household');
    expect(
      classifySignedInInvitee(MEMBER_BUNDLE, [receivedInvite('accepted_pending_handoff')]),
    ).toBe('has-household');
  });

  it('sends an account that was handed a key to the waiting screen to finish joining', () => {
    // The invite is `completed` by now, so no live claim is left in the list.
    expect(classifySignedInInvitee(READY_TO_JOIN_BUNDLE, [receivedInvite('completed')])).toBe(
      'waiting',
    );
  });

  it('sends an account with a live claim to the waiting screen', () => {
    const received = [receivedInvite('revoked'), receivedInvite('accepted_pending_handoff')];

    expect(classifySignedInInvitee(AWAITING_HANDOFF_BUNDLE, received)).toBe('waiting');
  });

  it('offers accept to an account that claimed nothing, as after a failed claim', () => {
    expect(classifySignedInInvitee(AWAITING_HANDOFF_BUNDLE, [])).toBe('can-accept');
  });

  it('offers accept when the only claimed invite was revoked, as when one is re-sent', () => {
    expect(classifySignedInInvitee(AWAITING_HANDOFF_BUNDLE, [receivedInvite('revoked')])).toBe(
      'can-accept',
    );
  });
});

describe('classifyAcceptFailure', () => {
  it('names an address mismatch without choosing its sentence', () => {
    expect(classifyAcceptFailure(codedError(403, 'EMAIL_MISMATCH'))).toEqual({
      kind: 'wrong-address',
    });
  });

  it('recognises an account that already has a household', () => {
    expect(classifyAcceptFailure(codedError(409, 'HOUSEHOLD_FULL'))).toEqual({
      kind: 'has-household',
    });
  });

  it('gives each dead invite its own sentence', () => {
    // The statuses `assertAcceptable` sends with each code.
    const deadInviteErrors = [
      codedError(404, 'INVALID_INVITE'),
      codedError(410, 'INVITE_EXPIRED'),
      codedError(409, 'INVITE_ALREADY_ACCEPTED'),
    ];
    const messages = deadInviteErrors.map((err) => {
      const failure = classifyAcceptFailure(err);
      return failure.kind === 'unusable' ? failure.message : null;
    });

    expect(messages.every((message) => message !== null)).toBe(true);
    expect(new Set(messages).size).toBe(3);
  });

  it('never tells an expired invite it was used', () => {
    const failure = classifyAcceptFailure(codedError(410, 'INVITE_EXPIRED'));

    expect(failure).toMatchObject({ kind: 'unusable', message: expect.stringMatching(/expired/) });
    expect(failure).not.toMatchObject({ message: expect.stringMatching(/used/) });
  });

  it('does not claim a revoked-or-used invite was definitely used', () => {
    const failure = classifyAcceptFailure(codedError(409, 'INVITE_ALREADY_ACCEPTED'));

    expect(failure).toMatchObject({
      kind: 'unusable',
      message: expect.stringMatching(/cancelled/),
    });
  });

  it('recognises a rate limit that carries no code', () => {
    expect(classifyAcceptFailure(new ApiError('Too many requests', 429))).toEqual({
      kind: 'rate-limited',
    });
  });

  it('leaves anything else to the caller', () => {
    expect(classifyAcceptFailure(new ApiError('Internal error', 500))).toEqual({ kind: 'other' });
    expect(classifyAcceptFailure(new TypeError('Failed to fetch'))).toEqual({ kind: 'other' });
  });
});
