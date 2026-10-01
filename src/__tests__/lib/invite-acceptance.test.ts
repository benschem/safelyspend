import { describe, it, expect } from 'vitest';
import { ApiError, type InviteStatus, type ReceivedInvite } from '@/lib/api-client';
import { classifyAcceptFailure, classifySignedInInvitee } from '@/lib/invite-acceptance';

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

describe('classifySignedInInvitee', () => {
  it('reports a household whatever the received list holds', () => {
    const household = { id: 'household-1', name: 'Household' };

    expect(classifySignedInInvitee(household, [])).toBe('has-household');
    expect(classifySignedInInvitee(household, [receivedInvite('accepted_pending_handoff')])).toBe(
      'has-household',
    );
  });

  it('sends an account with a live claim to the waiting screen', () => {
    const received = [receivedInvite('revoked'), receivedInvite('accepted_pending_handoff')];

    expect(classifySignedInInvitee(null, received)).toBe('waiting');
  });

  it('offers accept to an account that claimed nothing, as after a failed claim', () => {
    expect(classifySignedInInvitee(null, [])).toBe('can-accept');
  });

  it('offers accept when the only claimed invite was revoked, as when one is re-sent', () => {
    expect(classifySignedInInvitee(null, [receivedInvite('revoked')])).toBe('can-accept');
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
