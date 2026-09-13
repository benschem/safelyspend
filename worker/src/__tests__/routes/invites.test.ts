/** The invite and handoff surface, end to end.
 *
 *  The choreography under test is the one from crypto-design section 7.2: the inviter
 *  is the active party and wraps the MasterKey on their next login, while the invitee
 *  polls. The two are never online together, and the tests keep that ordering.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import {
  applyMigrations,
  authedRequest,
  createAuthenticatedUser,
  jsonRequest,
  appFetch,
} from '../helpers/setup.js';
import * as fixtures from '../helpers/fixtures.js';
import { sendAuthCode, sendInvite } from '../../services/email.js';
import * as inviteService from '../../services/invites.js';

const mockSendAuthCode = vi.mocked(sendAuthCode);
const mockSendInvite = vi.mocked(sendInvite);

beforeAll(async () => {
  await applyMigrations(env.DB);
});

beforeEach(() => {
  mockSendAuthCode.mockClear();
  mockSendInvite.mockClear();
  mockSendInvite.mockResolvedValue(undefined);
});

function capturedCode(): string {
  const code = mockSendAuthCode.mock.lastCall?.[3];
  if (!code) throw new Error('sendAuthCode was not called');
  return code;
}

/** The invite token the server emailed, which only the recipient would normally see. */
function capturedInviteToken(): string {
  const token = mockSendInvite.mock.lastCall?.[5];
  if (!token) throw new Error('sendInvite was not called');
  return token;
}

async function bridgeToken(email: string): Promise<string> {
  await appFetch(jsonRequest('/v1/auth/login', { email }));
  const res = await appFetch(jsonRequest('/v1/auth/verify-otp', { email, code: capturedCode() }));
  return ((await res.json()) as { authPendingToken: string }).authPendingToken;
}

/** A signed-up account with its own household — the inviting side. */
async function createInviter(email: string): Promise<{ cookie: string; householdId: string }> {
  const res = await appFetch(
    jsonRequest('/v1/auth/signup', fixtures.signupBody(await bridgeToken(email))),
  );
  expect(res.status).toBe(200);

  const body = (await res.json()) as { household: { id: string } };
  return {
    cookie: res.headers.get('set-cookie')!.split(';')[0]!,
    householdId: body.household.id,
  };
}

async function issueInvite(cookie: string, recipientEmail: string): Promise<string> {
  const res = await appFetch(jsonRequest('/v1/invites', { recipientEmail }, { cookie }));
  expect(res.status).toBe(201);
  return capturedInviteToken();
}

/** An account created against an invite — no household, no MasterKey yet. */
async function acceptAsNewUser(
  email: string,
  inviteToken: string,
): Promise<{ cookie: string; userId: string }> {
  const res = await appFetch(
    jsonRequest(
      '/v1/auth/signup-with-invite',
      fixtures.signupWithInviteBody(await bridgeToken(email), inviteToken),
    ),
  );
  expect(res.status).toBe(200);

  const body = (await res.json()) as { user: { id: string } };
  return {
    cookie: res.headers.get('set-cookie')!.split(';')[0]!,
    userId: body.user.id,
  };
}

/** Walk the handoff from pending sweep through to the invitee's rewrap, for the tests
 *  that need a completed two-person household rather than the handoff itself. */
async function completeHandoff(
  inviter: { cookie: string; householdId: string },
  partner: { cookie: string; userId: string },
): Promise<void> {
  const pendingRes = await appFetch(authedRequest('/v1/handoffs/pending', inviter.cookie));
  const { handoffs } = (await pendingRes.json()) as {
    handoffs: Array<{ inviteId: string; inviteeUserId: string }>;
  };
  const handoff = handoffs.find((entry) => entry.inviteeUserId === partner.userId)!;

  const addRes = await appFetch(
    jsonRequest(
      `/v1/households/${inviter.householdId}/members`,
      {
        inviteId: handoff.inviteId,
        inviteeUserId: partner.userId,
        wrappedMasterKey: fixtures.envelopeC(),
        senderPubkey: fixtures.pubkey(),
      },
      { cookie: inviter.cookie },
    ),
  );
  expect(addRes.status).toBe(200);

  const rewrapRes = await appFetch(
    jsonRequest(
      `/v1/households/${inviter.householdId}/members/${partner.userId}/rewrap`,
      { memberKeys: fixtures.memberKeys() },
      { cookie: partner.cookie },
    ),
  );
  expect(rewrapRes.status).toBe(200);
}

describe('invites.status', () => {
  /** Insert a bare invite row, bypassing the service, to see what the table accepts. */
  async function insertWithStatus(status: string): Promise<void> {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO invites
         (id, token, sender_user_id, household_id, recipient_email, status, expires_at,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        `status-${status}`,
        `token-${status}`,
        statusProbe.userId,
        statusProbe.householdId,
        'status@example.com',
        status,
        now,
        now,
        now,
      )
      .run();
  }

  let statusProbe: { userId: string; householdId: string };

  beforeAll(async () => {
    const probe = await createAuthenticatedUser(env.DB);
    statusProbe = { userId: probe.user.id, householdId: probe.householdId! };
  });

  // The CHECK constraint and INVITE_STATUSES are two copies of one list, and SQLite
  // cannot extend a CHECK in place. A value added to the union without a matching
  // table rebuild type-checks everywhere and only fails on the write.
  it.each(inviteService.INVITE_STATUSES)('accepts %s, which the type union declares', async (status) => {
    await expect(insertWithStatus(status)).resolves.not.toThrow();
  });

  it('rejects a status the union does not declare', async () => {
    await expect(insertWithStatus('mislaid')).rejects.toThrow();
  });
});

describe('POST /invites', () => {
  it('issues an invite and emails the recipient a token', async () => {
    const { cookie } = await createInviter('inviter-ok@example.com');

    const res = await appFetch(
      jsonRequest('/v1/invites', { recipientEmail: 'Partner@Example.com' }, { cookie }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      invite: { id: string; recipientEmail: string; status: string; token?: string };
    };
    expect(body.invite.status).toBe('open');
    expect(body.invite.recipientEmail).toBe('partner@example.com');
    // The token goes to the recipient's inbox, never back to the sender's client.
    expect(body.invite.token).toBeUndefined();
    expect(mockSendInvite).toHaveBeenCalledOnce();
  });

  it('refuses to invite yourself', async () => {
    const email = 'inviter-self@example.com';
    const { cookie } = await createInviter(email);

    const res = await appFetch(jsonRequest('/v1/invites', { recipientEmail: email }, { cookie }));

    expect(res.status).toBe(400);
  });

  it('refuses a second open invite to the same address', async () => {
    const { cookie } = await createInviter('inviter-dup@example.com');
    await issueInvite(cookie, 'dup-partner@example.com');

    const res = await appFetch(
      jsonRequest('/v1/invites', { recipientEmail: 'dup-partner@example.com' }, { cookie }),
    );

    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('INVITE_ALREADY_PENDING');
  });

  it.each([0, 8, 2.5])('rejects an expiry of %s days', async (expiresInDays) => {
    const { cookie } = await createInviter(`inviter-expiry-${expiresInDays}@example.com`);

    const res = await appFetch(
      jsonRequest(
        '/v1/invites',
        { recipientEmail: 'expiry-partner@example.com', expiresInDays },
        { cookie },
      ),
    );

    expect(res.status).toBe(400);
  });

  it('rolls the invite back when the email fails to send', async () => {
    const { cookie } = await createInviter('inviter-emailfail@example.com');
    mockSendInvite.mockRejectedValueOnce(new Error('resend is down'));

    const res = await appFetch(
      jsonRequest('/v1/invites', { recipientEmail: 'unreachable@example.com' }, { cookie }),
    );

    expect(res.status).toBe(500);

    // An invite nobody received would otherwise occupy the one-open-invite slot.
    const row = await env.DB
      .prepare('SELECT id FROM invites WHERE recipient_email = ?')
      .bind('unreachable@example.com')
      .first();
    expect(row).toBeNull();
  });

  it('refuses to invite a third person into a full household', async () => {
    const inviter = await createInviter('full-inviter@example.com');
    const token = await issueInvite(inviter.cookie, 'full-partner@example.com');
    const partner = await acceptAsNewUser('full-partner@example.com', token);
    await completeHandoff(inviter, partner);

    const res = await appFetch(
      jsonRequest('/v1/invites', { recipientEmail: 'third-wheel@example.com' }, { cookie: inviter.cookie }),
    );

    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('HOUSEHOLD_FULL');
  });

  it('requires a household to invite from', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB, { withoutHousehold: true });

    const res = await appFetch(
      jsonRequest('/v1/invites', { recipientEmail: 'nobody@example.com' }, { cookie }),
    );

    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('NO_HOUSEHOLD');
  });
});

describe('POST /auth/signup-with-invite', () => {
  it('creates the account without a household or member keys', async () => {
    const inviter = await createInviter('swi-inviter@example.com');
    const token = await issueInvite(inviter.cookie, 'swi-partner@example.com');

    const res = await appFetch(
      jsonRequest(
        '/v1/auth/signup-with-invite',
        fixtures.signupWithInviteBody(await bridgeToken('swi-partner@example.com'), token),
      ),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      household: null;
      invite: { status: string; senderEmail: string; senderPubkey: string };
      keyBundle: { userKeys: unknown[]; memberKeys: unknown[] };
    };

    // No membership row yet: a member without a MasterKey would be handed vault bytes
    // they cannot decrypt.
    expect(body.household).toBeNull();
    expect(body.keyBundle.memberKeys).toHaveLength(0);
    expect(body.keyBundle.userKeys).toHaveLength(2);
    expect(body.invite.status).toBe('accepted_pending_handoff');
    expect(body.invite.senderEmail).toBe('swi-inviter@example.com');
    // Needed for the out-of-band safety-number check before the invitee unwraps.
    expect(body.invite.senderPubkey).toBe(fixtures.pubkey());
  });

  it('rejects an invite addressed to a different email', async () => {
    const inviter = await createInviter('swi-mismatch-inviter@example.com');
    const token = await issueInvite(inviter.cookie, 'intended@example.com');

    const res = await appFetch(
      jsonRequest(
        '/v1/auth/signup-with-invite',
        fixtures.signupWithInviteBody(await bridgeToken('interloper@example.com'), token),
      ),
    );

    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe('EMAIL_MISMATCH');
  });

  it('rejects an unknown invite token', async () => {
    const res = await appFetch(
      jsonRequest(
        '/v1/auth/signup-with-invite',
        fixtures.signupWithInviteBody(await bridgeToken('swi-unknown@example.com'), 'no-such-token'),
      ),
    );

    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe('INVALID_INVITE');
  });

  it('rejects an expired invite', async () => {
    const inviter = await createInviter('swi-expired-inviter@example.com');
    const token = await issueInvite(inviter.cookie, 'swi-expired@example.com');

    await env.DB
      .prepare('UPDATE invites SET expires_at = ? WHERE token = ?')
      .bind(new Date(Date.now() - 1000).toISOString(), token)
      .run();

    const res = await appFetch(
      jsonRequest(
        '/v1/auth/signup-with-invite',
        fixtures.signupWithInviteBody(await bridgeToken('swi-expired@example.com'), token),
      ),
    );

    expect(res.status).toBe(410);
    expect(((await res.json()) as { code: string }).code).toBe('INVITE_EXPIRED');
  });

  it('rejects an invite that has already been claimed', async () => {
    const inviter = await createInviter('swi-claimed-inviter@example.com');
    const token = await issueInvite(inviter.cookie, 'swi-claimed@example.com');
    await acceptAsNewUser('swi-claimed@example.com', token);

    const res = await appFetch(
      jsonRequest(
        '/v1/auth/signup-with-invite',
        fixtures.signupWithInviteBody(await bridgeToken('swi-claimed@example.com'), token),
      ),
    );

    // The account exists now, so it trips the signup guard before the invite guard.
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('ALREADY_SIGNED_UP');
  });
});

describe('POST /invites/:token/accept', () => {
  it('attaches the invite to an existing account without a household', async () => {
    const inviter = await createInviter('accept-inviter@example.com');
    const existing = await createAuthenticatedUser(env.DB, {
      withoutHousehold: true,
      email: 'accept-existing@example.com',
    });
    const token = await issueInvite(inviter.cookie, 'accept-existing@example.com');

    const res = await appFetch(
      authedRequest(`/v1/invites/${token}/accept`, existing.cookie, 'POST'),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { household: null; invite: { status: string } };
    expect(body.household).toBeNull();
    expect(body.invite.status).toBe('accepted_pending_handoff');
  });

  it('refuses someone who already belongs to a household', async () => {
    const inviter = await createInviter('accept-busy-inviter@example.com');
    const busy = await createAuthenticatedUser(env.DB, { email: 'accept-busy@example.com' });
    const token = await issueInvite(inviter.cookie, 'accept-busy@example.com');

    const res = await appFetch(authedRequest(`/v1/invites/${token}/accept`, busy.cookie, 'POST'));

    // Q5: one household per user in v1.
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('HOUSEHOLD_FULL');
  });

  it('refuses an invite addressed to someone else', async () => {
    const inviter = await createInviter('accept-wrong-inviter@example.com');
    const other = await createAuthenticatedUser(env.DB, {
      withoutHousehold: true,
      email: 'accept-wrong@example.com',
    });
    const token = await issueInvite(inviter.cookie, 'accept-intended@example.com');

    const res = await appFetch(authedRequest(`/v1/invites/${token}/accept`, other.cookie, 'POST'));

    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe('EMAIL_MISMATCH');
  });
});

describe('DELETE /invites/:id', () => {
  it('revokes an open invite', async () => {
    const { cookie } = await createInviter('revoke-inviter@example.com');
    const res = await appFetch(
      jsonRequest('/v1/invites', { recipientEmail: 'revoke-partner@example.com' }, { cookie }),
    );
    const { invite } = (await res.json()) as { invite: { id: string } };

    const deleteRes = await appFetch(
      authedRequest(`/v1/invites/${invite.id}`, cookie, 'DELETE'),
    );

    expect(deleteRes.status).toBe(200);
    const row = await env.DB
      .prepare('SELECT status FROM invites WHERE id = ?')
      .bind(invite.id)
      .first<{ status: string }>();
    expect(row?.status).toBe('revoked');
  });

  it('refuses to revoke someone else\'s invite', async () => {
    const inviter = await createInviter('revoke-owner@example.com');
    const stranger = await createInviter('revoke-stranger@example.com');
    const res = await appFetch(
      jsonRequest(
        '/v1/invites',
        { recipientEmail: 'revoke-target@example.com' },
        { cookie: inviter.cookie },
      ),
    );
    const { invite } = (await res.json()) as { invite: { id: string } };

    const deleteRes = await appFetch(
      authedRequest(`/v1/invites/${invite.id}`, stranger.cookie, 'DELETE'),
    );

    expect(deleteRes.status).toBe(403);
  });
});

describe('the handoff, end to end', () => {
  it('walks an invitee from invite through to a shared vault', async () => {
    const inviter = await createInviter('handoff-a@example.com');
    const token = await issueInvite(inviter.cookie, 'handoff-b@example.com');
    const partner = await acceptAsNewUser('handoff-b@example.com', token);

    // The inviter sweeps on their next login and sees who is waiting.
    const pendingRes = await appFetch(authedRequest('/v1/handoffs/pending', inviter.cookie));
    expect(pendingRes.status).toBe(200);
    const { handoffs: pending } = (await pendingRes.json()) as {
      handoffs: Array<{
        inviteId: string;
        inviteeUserId: string;
        inviteePubkey: string;
        inviteePubkeyFingerprint: string;
        recipientEmail: string;
      }>;
    };
    expect(pending).toHaveLength(1);
    expect(pending[0]!.inviteeUserId).toBe(partner.userId);
    expect(pending[0]!.recipientEmail).toBe('handoff-b@example.com');
    expect(pending[0]!.inviteePubkey).toBe(fixtures.pubkey(0x77));
    // 8 bytes of SHA-256, hex — the client recomputes this before showing it.
    expect(pending[0]!.inviteePubkeyFingerprint).toMatch(/^[0-9a-f]{16}$/);

    // The inviter wraps the MasterKey for the invitee's public key.
    const addRes = await appFetch(
      jsonRequest(
        `/v1/households/${inviter.householdId}/members`,
        {
          inviteId: pending[0]!.inviteId,
          inviteeUserId: partner.userId,
          wrappedMasterKey: fixtures.envelopeC(),
          senderPubkey: fixtures.pubkey(),
        },
        { cookie: inviter.cookie },
      ),
    );
    expect(addRes.status).toBe(200);

    // The invitee's poll now returns the wrap and the sender's fingerprint.
    const incomingRes = await appFetch(authedRequest('/v1/handoffs/incoming', partner.cookie));
    const { handoffs: incoming } = (await incomingRes.json()) as {
      handoffs: Array<{
        householdId: string;
        kekKind: string;
        wrappedMasterKey: string;
        senderEmail: string;
        senderPubkey: string;
        senderPubkeyFingerprint: string;
      }>;
    };
    expect(incoming).toHaveLength(1);
    expect(incoming[0]!.kekKind).toBe('ecies');
    expect(incoming[0]!.householdId).toBe(inviter.householdId);
    expect(incoming[0]!.wrappedMasterKey).toBe(fixtures.envelopeC());
    expect(incoming[0]!.senderEmail).toBe('handoff-a@example.com');
    expect(incoming[0]!.senderPubkey).toBe(fixtures.pubkey());
    expect(incoming[0]!.senderPubkeyFingerprint).toMatch(/^[0-9a-f]{16}$/);

    // The invitee unwraps locally and rewraps under their own KEKs.
    const rewrapRes = await appFetch(
      jsonRequest(
        `/v1/households/${inviter.householdId}/members/${partner.userId}/rewrap`,
        { memberKeys: fixtures.memberKeys() },
        { cookie: partner.cookie },
      ),
    );
    expect(rewrapRes.status).toBe(200);

    // The transient row is gone and two durable ones remain.
    const bundle = (await (
      await appFetch(authedRequest('/v1/auth/key-bundle', partner.cookie))
    ).json()) as {
      household: { id: string };
      memberKeys: Array<{ kekKind: string }>;
    };
    expect(bundle.household.id).toBe(inviter.householdId);
    expect(bundle.memberKeys.map((k) => k.kekKind).sort()).toEqual(['pwd', 'recovery']);

    // Both polls are now quiet, and the invite is done.
    expect(
      ((await (await appFetch(authedRequest('/v1/handoffs/incoming', partner.cookie))).json()) as {
        handoffs: unknown[];
      }).handoffs,
    ).toHaveLength(0);
    expect(
      ((await (await appFetch(authedRequest('/v1/handoffs/pending', inviter.cookie))).json()) as {
        handoffs: unknown[];
      }).handoffs,
    ).toHaveLength(0);

    const invite = await env.DB
      .prepare('SELECT status FROM invites WHERE token = ?')
      .bind(token)
      .first<{ status: string }>();
    expect(invite?.status).toBe('completed');
  });

  it('gives the invitee vault access only once the handoff completes', async () => {
    const inviter = await createInviter('access-a@example.com');
    const token = await issueInvite(inviter.cookie, 'access-b@example.com');
    const partner = await acceptAsNewUser('access-b@example.com', token);

    // Before: no membership, so no scope to read.
    const before = await appFetch(authedRequest('/v1/vault', partner.cookie));
    expect(before.status).toBe(409);
    expect(((await before.json()) as { code: string }).code).toBe('NO_HOUSEHOLD');

    await completeHandoff(inviter, partner);

    // After: same household, same vault, without having logged in again.
    const after = await appFetch(authedRequest('/v1/vault', partner.cookie));
    expect(after.status).toBe(200);
  });
});

describe('POST /households/:householdId/members', () => {
  it('rejects a sender public key that is not the caller\'s own', async () => {
    const inviter = await createInviter('sub-a@example.com');
    const token = await issueInvite(inviter.cookie, 'sub-b@example.com');
    const partner = await acceptAsNewUser('sub-b@example.com', token);

    const { handoffs } = (await (
      await appFetch(authedRequest('/v1/handoffs/pending', inviter.cookie))
    ).json()) as { handoffs: Array<{ inviteId: string }> };

    const res = await appFetch(
      jsonRequest(
        `/v1/households/${inviter.householdId}/members`,
        {
          inviteId: handoffs[0]!.inviteId,
          inviteeUserId: partner.userId,
          wrappedMasterKey: fixtures.envelopeC(),
          senderPubkey: fixtures.pubkey(0x99),
        },
        { cookie: inviter.cookie },
      ),
    );

    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('INVALID_BLOB');
  });

  it('rejects an envelope A blob where envelope C is required', async () => {
    const inviter = await createInviter('envc-a@example.com');
    const token = await issueInvite(inviter.cookie, 'envc-b@example.com');
    const partner = await acceptAsNewUser('envc-b@example.com', token);

    const { handoffs } = (await (
      await appFetch(authedRequest('/v1/handoffs/pending', inviter.cookie))
    ).json()) as { handoffs: Array<{ inviteId: string }> };

    const res = await appFetch(
      jsonRequest(
        `/v1/households/${inviter.householdId}/members`,
        {
          inviteId: handoffs[0]!.inviteId,
          inviteeUserId: partner.userId,
          wrappedMasterKey: fixtures.wrappedMasterKey(),
          senderPubkey: fixtures.pubkey(),
        },
        { cookie: inviter.cookie },
      ),
    );

    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('INVALID_BLOB');
  });

  it('refuses to add a member to somebody else\'s household', async () => {
    const inviter = await createInviter('other-a@example.com');
    const stranger = await createInviter('other-stranger@example.com');
    const token = await issueInvite(inviter.cookie, 'other-b@example.com');
    const partner = await acceptAsNewUser('other-b@example.com', token);

    const res = await appFetch(
      jsonRequest(
        `/v1/households/${inviter.householdId}/members`,
        {
          inviteId: 'whatever',
          inviteeUserId: partner.userId,
          wrappedMasterKey: fixtures.envelopeC(),
          senderPubkey: fixtures.pubkey(),
        },
        { cookie: stranger.cookie },
      ),
    );

    expect(res.status).toBe(403);
  });

  it('is idempotent on a replayed request', async () => {
    const inviter = await createInviter('replay-a@example.com');
    const token = await issueInvite(inviter.cookie, 'replay-b@example.com');
    const partner = await acceptAsNewUser('replay-b@example.com', token);

    const { handoffs } = (await (
      await appFetch(authedRequest('/v1/handoffs/pending', inviter.cookie))
    ).json()) as { handoffs: Array<{ inviteId: string }> };

    const body = {
      inviteId: handoffs[0]!.inviteId,
      inviteeUserId: partner.userId,
      wrappedMasterKey: fixtures.envelopeC(),
      senderPubkey: fixtures.pubkey(),
    };

    const first = await appFetch(
      jsonRequest(`/v1/households/${inviter.householdId}/members`, body, { cookie: inviter.cookie }),
    );
    const second = await appFetch(
      jsonRequest(`/v1/households/${inviter.householdId}/members`, body, { cookie: inviter.cookie }),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const count = await env.DB
      .prepare('SELECT COUNT(*) AS count FROM household_members WHERE household_id = ?')
      .bind(inviter.householdId)
      .first<{ count: number }>();
    expect(count?.count).toBe(2);
  });
});

describe('POST /households/:householdId/members/:userId/rewrap', () => {
  it('refuses to rewrap somebody else\'s keys', async () => {
    const inviter = await createInviter('rw-a@example.com');
    const token = await issueInvite(inviter.cookie, 'rw-b@example.com');
    const partner = await acceptAsNewUser('rw-b@example.com', token);

    const res = await appFetch(
      jsonRequest(
        `/v1/households/${inviter.householdId}/members/${partner.userId}/rewrap`,
        { memberKeys: fixtures.memberKeys() },
        { cookie: inviter.cookie },
      ),
    );

    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe('NOT_OWN_KEYS');
  });

  it('refuses when there is no handoff waiting', async () => {
    const inviter = await createInviter('rw-nohandoff-a@example.com');
    const token = await issueInvite(inviter.cookie, 'rw-nohandoff-b@example.com');
    const partner = await acceptAsNewUser('rw-nohandoff-b@example.com', token);

    const res = await appFetch(
      jsonRequest(
        `/v1/households/${inviter.householdId}/members/${partner.userId}/rewrap`,
        { memberKeys: fixtures.memberKeys() },
        { cookie: partner.cookie },
      ),
    );

    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('NO_PENDING_HANDOFF');
  });

  it('rejects a partial rewrap that omits the recovery kind', async () => {
    const inviter = await createInviter('rw-partial-a@example.com');
    const token = await issueInvite(inviter.cookie, 'rw-partial-b@example.com');
    const partner = await acceptAsNewUser('rw-partial-b@example.com', token);

    const { handoffs } = (await (
      await appFetch(authedRequest('/v1/handoffs/pending', inviter.cookie))
    ).json()) as { handoffs: Array<{ inviteId: string }> };
    await appFetch(
      jsonRequest(
        `/v1/households/${inviter.householdId}/members`,
        {
          inviteId: handoffs[0]!.inviteId,
          inviteeUserId: partner.userId,
          wrappedMasterKey: fixtures.envelopeC(),
          senderPubkey: fixtures.pubkey(),
        },
        { cookie: inviter.cookie },
      ),
    );

    const res = await appFetch(
      jsonRequest(
        `/v1/households/${inviter.householdId}/members/${partner.userId}/rewrap`,
        { memberKeys: [fixtures.memberKeys()[0]] },
        { cookie: partner.cookie },
      ),
    );

    // A rewrap that lands only the password row would leave the recovery phrase
    // pointing at a key the invitee never stored.
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('INVALID_BLOB');

    // And the transient row must survive, so the invitee can retry.
    const ecies = await env.DB
      .prepare(
        "SELECT kek_kind FROM household_member_keys WHERE user_id = ? AND kek_kind = 'ecies'",
      )
      .bind(partner.userId)
      .first();
    expect(ecies).not.toBeNull();
  });

  it('is retryable after a crash between unwrap and rewrap', async () => {
    const inviter = await createInviter('rw-retry-a@example.com');
    const token = await issueInvite(inviter.cookie, 'rw-retry-b@example.com');
    const partner = await acceptAsNewUser('rw-retry-b@example.com', token);
    await completeHandoff(inviter, partner);

    // The transient row is gone, so a second rewrap is refused rather than silently
    // rewriting the durable rows.
    const res = await appFetch(
      jsonRequest(
        `/v1/households/${inviter.householdId}/members/${partner.userId}/rewrap`,
        { memberKeys: fixtures.memberKeys() },
        { cookie: partner.cookie },
      ),
    );

    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('NO_PENDING_HANDOFF');
  });
});

describe('invite and handoff routes without auth', () => {
  it.each([
    ['GET', '/v1/invites'],
    ['GET', '/v1/handoffs/pending'],
    ['GET', '/v1/handoffs/incoming'],
  ])('%s %s returns 401', async (method, path) => {
    const res = await appFetch(new Request(`http://localhost${path}`, { method }));
    expect(res.status).toBe(401);
  });
});
