import { describe, it, expect } from 'vitest';
import { ApiError, type InviteStatus, type SentInvite } from '@/lib/api-client';
import {
  classifyIssueFailure,
  hasLiveInvite,
  recipientAddressProblem,
  sentInviteState,
  visibleSentInvites,
} from '@/lib/invite-sending';

const EXPIRES_AT = '2026-09-21T00:00:00.000Z';
const BEFORE_EXPIRY = new Date('2026-09-20T23:59:59.000Z');
const AT_EXPIRY = new Date(EXPIRES_AT);
const AFTER_EXPIRY = new Date('2026-09-25T00:00:00.000Z');

function sentInvite(status: InviteStatus, recipientEmail = 'partner@example.com'): SentInvite {
  return {
    id: `invite-${status}-${recipientEmail}`,
    recipientEmail,
    status,
    expiresAt: EXPIRES_AT,
    createdAt: '2026-09-18T00:00:00.000Z',
  };
}

function codedError(status: number, code: string) {
  return new ApiError('worker message', status, { error: 'worker message', code });
}

describe('sentInviteState', () => {
  it('is pending for an open invite before its expiry', () => {
    expect(sentInviteState(sentInvite('open'), BEFORE_EXPIRY)).toBe('pending');
  });

  it('is expired for an invite the worker still calls open after its expiry', () => {
    expect(sentInviteState(sentInvite('open'), AFTER_EXPIRY)).toBe('expired');
  });

  it('is expired at the moment of expiry, as the worker treats it', () => {
    expect(sentInviteState(sentInvite('open'), AT_EXPIRY)).toBe('expired');
  });

  it('is awaiting approval once the recipient has claimed it', () => {
    expect(sentInviteState(sentInvite('accepted_pending_handoff'), BEFORE_EXPIRY)).toBe(
      'awaiting-approval',
    );
  });

  it('is still awaiting approval when a claimed invite passes its expiry', () => {
    expect(sentInviteState(sentInvite('accepted_pending_handoff'), AFTER_EXPIRY)).toBe(
      'awaiting-approval',
    );
  });

  it('is expired once the worker has marked it so', () => {
    expect(sentInviteState(sentInvite('expired'), AFTER_EXPIRY)).toBe('expired');
  });

  it('is joined for a completed invite, whatever the date', () => {
    expect(sentInviteState(sentInvite('completed'), AFTER_EXPIRY)).toBe('joined');
  });

  it.each(['revoked', 'declined'] as const)('is hidden for a %s invite', (status) => {
    expect(sentInviteState(sentInvite(status), BEFORE_EXPIRY)).toBe('hidden');
  });
});

describe('visibleSentInvites', () => {
  it('drops revoked and declined invites and keeps the order of the rest', () => {
    const sent = [
      sentInvite('open', 'newest@example.com'),
      sentInvite('revoked', 'cancelled@example.com'),
      sentInvite('completed', 'joined@example.com'),
      sentInvite('declined', 'declined@example.com'),
    ];

    expect(visibleSentInvites(sent, BEFORE_EXPIRY)).toEqual([
      { invite: sent[0], state: 'pending' },
      { invite: sent[2], state: 'joined' },
    ]);
  });

  it('keeps an expired invite beside the one that replaced it', () => {
    const replacement = {
      ...sentInvite('open'),
      id: 'replacement',
      expiresAt: '2026-09-30T00:00:00.000Z',
    };
    const sent = [replacement, sentInvite('expired')];

    expect(visibleSentInvites(sent, AFTER_EXPIRY).map((row) => row.state)).toEqual([
      'pending',
      'expired',
    ]);
  });

  it('is empty when nothing was ever sent', () => {
    expect(visibleSentInvites([], BEFORE_EXPIRY)).toEqual([]);
  });
});

describe('hasLiveInvite', () => {
  it('is true while an open invite has not expired', () => {
    expect(hasLiveInvite([sentInvite('open')], BEFORE_EXPIRY)).toBe(true);
  });

  it('is true while a recipient waits for approval, even past the expiry', () => {
    expect(hasLiveInvite([sentInvite('accepted_pending_handoff')], AFTER_EXPIRY)).toBe(true);
  });

  it('is false for an open invite that has lapsed', () => {
    expect(hasLiveInvite([sentInvite('open')], AFTER_EXPIRY)).toBe(false);
  });

  it('is false when every invite is finished one way or another', () => {
    const sent = [sentInvite('completed'), sentInvite('revoked'), sentInvite('expired')];
    expect(hasLiveInvite(sent, BEFORE_EXPIRY)).toBe(false);
  });

  it('is true when a live invite sits among finished ones', () => {
    const sent = [sentInvite('revoked'), sentInvite('open', 'other@example.com')];
    expect(hasLiveInvite(sent, BEFORE_EXPIRY)).toBe(true);
  });

  it('is false when nothing was ever sent', () => {
    expect(hasLiveInvite([], BEFORE_EXPIRY)).toBe(false);
  });
});

describe('recipientAddressProblem', () => {
  const SENDER_ADDRESS = 'sender@example.com';

  it('accepts an address that is not the sender', () => {
    expect(recipientAddressProblem('partner@example.com', SENDER_ADDRESS)).toBeNull();
  });

  it.each(['', 'partner', 'partner@', 'partner@example', 'part ner@example.com'])(
    'rejects %j as not an address',
    (address) => {
      expect(recipientAddressProblem(address, SENDER_ADDRESS)).toBe('not-an-address');
    },
  );

  it("rejects the sender's own address", () => {
    expect(recipientAddressProblem(SENDER_ADDRESS, SENDER_ADDRESS)).toBe('own-address');
  });

  it("rejects the sender's own address however it was typed", () => {
    expect(recipientAddressProblem(' Sender@Example.com ', SENDER_ADDRESS)).toBe('own-address');
  });

  it('accepts a valid address typed with stray spaces and capitals', () => {
    expect(recipientAddressProblem(' Partner@Example.com ', SENDER_ADDRESS)).toBeNull();
  });

  it("rejects the sender's own address however the account stores its case", () => {
    expect(recipientAddressProblem(SENDER_ADDRESS, ' Sender@Example.com ')).toBe('own-address');
  });
});

describe('classifyIssueFailure', () => {
  it('reads a full household from its code', () => {
    expect(classifyIssueFailure(codedError(409, 'HOUSEHOLD_FULL'))).toEqual({
      kind: 'household-full',
    });
  });

  it('reads an invite that is already pending from its code', () => {
    expect(classifyIssueFailure(codedError(409, 'INVITE_ALREADY_PENDING'))).toEqual({
      kind: 'already-pending',
    });
  });

  it('reads the rate limit from the status', () => {
    expect(classifyIssueFailure(codedError(429, 'TOO_MANY_REQUESTS'))).toEqual({
      kind: 'rate-limited',
    });
  });

  it.each([
    ['an account with no household', codedError(409, 'NO_HOUSEHOLD')],
    ['an email that could not be sent', codedError(500, 'INTERNAL_ERROR')],
    ['a rejected request', new ApiError('Recipient email is required', 400)],
    ['a dropped connection', new TypeError('Failed to fetch')],
  ])('treats %s as other', (_description, err) => {
    expect(classifyIssueFailure(err)).toEqual({ kind: 'other' });
  });
});
