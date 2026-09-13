import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import {
  applyMigrations,
  authedRequest,
  createAuthenticatedUser,
  jsonRequest,
  appFetch,
  COOKIE_NAME,
} from '../helpers/setup.js';
import * as fixtures from '../helpers/fixtures.js';
import { generateId } from '../../lib/id.js';
import { jwtSign } from '../../lib/crypto.js';
import { sendAuthCode } from '../../services/email.js';

const mockSendAuthCode = vi.mocked(sendAuthCode);

beforeAll(async () => {
  await applyMigrations(env.DB);
});

beforeEach(() => {
  mockSendAuthCode.mockClear();
});

function capturedCode(): string {
  const code = mockSendAuthCode.mock.lastCall?.[3];
  if (!code) throw new Error('sendAuthCode was not called');
  return code;
}

/** Run login + verify-otp for an email and return the bridge token response. */
async function getBridge(email: string): Promise<{
  authPendingToken: string;
  verifierSalt: string | null;
  verifierKdfKind: number | null;
}> {
  const loginRes = await appFetch(jsonRequest('/v1/auth/login', { email }));
  expect(loginRes.status).toBe(200);

  const res = await appFetch(jsonRequest('/v1/auth/verify-otp', { email, code: capturedCode() }));
  expect(res.status).toBe(200);
  return (await res.json()) as {
    authPendingToken: string;
    verifierSalt: string | null;
    verifierKdfKind: number | null;
  };
}

/** Sign up a brand-new cloud-sync account and hand back its session cookie. */
async function signUp(email: string): Promise<{ cookie: string; body: Record<string, unknown> }> {
  const { authPendingToken } = await getBridge(email);
  const res = await appFetch(
    jsonRequest('/v1/auth/signup', fixtures.signupBody(authPendingToken)),
  );
  expect(res.status).toBe(200);

  return {
    cookie: res.headers.get('set-cookie')!.split(';')[0]!,
    body: (await res.json()) as Record<string, unknown>,
  };
}

describe('POST /auth/login', () => {
  it('sends a 6-digit auth code for a valid email', async () => {
    const res = await appFetch(jsonRequest('/v1/auth/login', { email: 'user@example.com' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Code sent' });
    expect(mockSendAuthCode).toHaveBeenCalledOnce();
    expect(capturedCode()).toMatch(/^\d{6}$/);
  });

  it('rejects an invalid email format', async () => {
    const res = await appFetch(jsonRequest('/v1/auth/login', { email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('rejects a missing email', async () => {
    const res = await appFetch(jsonRequest('/v1/auth/login', {}));
    expect(res.status).toBe(400);
  });

  it('rejects the wrong content type', async () => {
    const res = await appFetch(
      new Request('http://localhost/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'email=user@example.com',
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/verify-otp', () => {
  it('returns a bridge token and a null salt for an account that has not signed up', async () => {
    const body = await getBridge('otp-fresh@example.com');

    expect(body.authPendingToken).toBeTruthy();
    // A null salt is how the client knows to route itself to signup, not to login.
    expect(body.verifierSalt).toBeNull();
    expect(body.verifierKdfKind).toBeNull();
  });

  it('returns the stored verifier parameters once the account has signed up', async () => {
    const email = 'otp-existing@example.com';
    await signUp(email);

    const body = await getBridge(email);
    expect(body.verifierSalt).toBe(fixtures.salt16());
    expect(body.verifierKdfKind).toBe(2);
  });

  it('rejects a wrong code without revealing anything', async () => {
    const email = 'otp-bad@example.com';
    await appFetch(jsonRequest('/v1/auth/login', { email }));

    const res = await appFetch(jsonRequest('/v1/auth/verify-otp', { email, code: '000000' }));

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Invalid email or code');
  });

  it('rejects an unknown email with the same generic message', async () => {
    const res = await appFetch(
      jsonRequest('/v1/auth/verify-otp', { email: 'nobody@example.com', code: '123456' }),
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Invalid email or code');
  });

  it('does not issue a session cookie on its own', async () => {
    const email = 'otp-nocookie@example.com';
    await appFetch(jsonRequest('/v1/auth/login', { email }));

    const res = await appFetch(
      jsonRequest('/v1/auth/verify-otp', { email, code: capturedCode() }),
    );

    expect(res.headers.get('set-cookie')).toBeNull();
  });
});

describe('POST /auth/signup', () => {
  it('creates the account, its household and both key pairs', async () => {
    const email = 'signup-ok@example.com';
    const { authPendingToken } = await getBridge(email);
    const body = fixtures.signupBody(authPendingToken);

    const res = await appFetch(jsonRequest('/v1/auth/signup', body));

    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('__budget_session=');

    const json = (await res.json()) as {
      user: { id: string; email: string };
      household: { id: string };
      keyBundle: { userKeys: unknown[]; memberKeys: unknown[] };
    };
    expect(json.user.email).toBe(email);
    expect(json.household.id).toBe((body['household'] as { id: string }).id);
    expect(json.keyBundle.userKeys).toHaveLength(2);
    expect(json.keyBundle.memberKeys).toHaveLength(2);

    const member = await env.DB
      .prepare('SELECT role FROM household_members WHERE user_id = ?')
      .bind(json.user.id)
      .first<{ role: string }>();
    expect(member?.role).toBe('owner');
  });

  it('stores the recovery row with a null salt rather than treating it as missing', async () => {
    const { body } = await signUp('signup-recovery@example.com');
    const keyBundle = body['keyBundle'] as {
      userKeys: Array<{ kekKind: string; kekSalt: string | null; kekKdfKind: number; kekKdfParams: string }>;
    };

    const recovery = keyBundle.userKeys.find((key) => key.kekKind === 'recovery');
    expect(recovery?.kekSalt).toBeNull();
    expect(recovery?.kekKdfKind).toBe(3);
    expect(recovery?.kekKdfParams).toBe('');
  });

  it('rejects a replayed bridge token', async () => {
    const { authPendingToken } = await getBridge('signup-replay@example.com');
    const first = await appFetch(
      jsonRequest('/v1/auth/signup', fixtures.signupBody(authPendingToken)),
    );
    expect(first.status).toBe(200);

    const second = await appFetch(
      jsonRequest('/v1/auth/signup', fixtures.signupBody(authPendingToken)),
    );

    expect(second.status).toBe(401);
    expect(((await second.json()) as { code: string }).code).toBe('AUTH_PENDING_INVALID');
  });

  it('rejects a second signup on an account that already has keys', async () => {
    const email = 'signup-twice@example.com';
    await signUp(email);

    const { authPendingToken } = await getBridge(email);
    const res = await appFetch(
      jsonRequest('/v1/auth/signup', fixtures.signupBody(authPendingToken)),
    );

    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('ALREADY_SIGNED_UP');
  });

  it('rejects key material that is missing the recovery kind', async () => {
    const { authPendingToken } = await getBridge('signup-partial@example.com');
    const body = fixtures.signupBody(authPendingToken, {
      userKeys: [fixtures.userKeys()[0]],
    });

    const res = await appFetch(jsonRequest('/v1/auth/signup', body));

    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('INVALID_BLOB');
  });

  it('rejects an envelope with the wrong kind byte in a wrapped-key slot', async () => {
    const { authPendingToken } = await getBridge('signup-wrongkind@example.com');
    const keys = fixtures.userKeys() as Array<Record<string, unknown>>;
    // A wrapped MasterKey envelope in the wrapped PrivKey slot.
    keys[0]!['wrappedPrivKey'] = fixtures.wrappedMasterKey();

    const res = await appFetch(
      jsonRequest('/v1/auth/signup', fixtures.signupBody(authPendingToken, { userKeys: keys })),
    );

    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('INVALID_BLOB');
  });

  it('does not spend the bridge token when the key material is malformed', async () => {
    const email = 'signup-retry@example.com';
    const { authPendingToken } = await getBridge(email);

    const bad = await appFetch(
      jsonRequest('/v1/auth/signup', fixtures.signupBody(authPendingToken, { pubkey: 'AAAA' })),
    );
    expect(bad.status).toBe(400);

    const good = await appFetch(
      jsonRequest('/v1/auth/signup', fixtures.signupBody(authPendingToken)),
    );
    expect(good.status).toBe(200);
  });
});

describe('POST /auth/login-complete', () => {
  it('issues a session when the verifier matches', async () => {
    const email = 'login-ok@example.com';
    await signUp(email);

    const { authPendingToken } = await getBridge(email);
    const res = await appFetch(
      jsonRequest('/v1/auth/login-complete', {
        authPendingToken,
        verifierCandidate: fixtures.verifier(),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('__budget_session=');

    const body = (await res.json()) as {
      user: { email: string };
      household: { id: string };
      keyBundle: { memberKeys: unknown[] };
    };
    expect(body.user.email).toBe(email);
    expect(body.household.id).toBeTruthy();
    expect(body.keyBundle.memberKeys).toHaveLength(2);
  });

  it('rejects a wrong verifier and does not set a cookie', async () => {
    const email = 'login-wrong@example.com';
    await signUp(email);

    const { authPendingToken } = await getBridge(email);
    const res = await appFetch(
      jsonRequest('/v1/auth/login-complete', {
        authPendingToken,
        verifierCandidate: fixtures.verifier(0x99),
      }),
    );

    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe('VERIFIER_MISMATCH');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('burns the bridge token even when the verifier is wrong', async () => {
    const email = 'login-burn@example.com';
    await signUp(email);

    const { authPendingToken } = await getBridge(email);
    await appFetch(
      jsonRequest('/v1/auth/login-complete', {
        authPendingToken,
        verifierCandidate: fixtures.verifier(0x99),
      }),
    );

    const retry = await appFetch(
      jsonRequest('/v1/auth/login-complete', {
        authPendingToken,
        verifierCandidate: fixtures.verifier(),
      }),
    );

    expect(retry.status).toBe(401);
    expect(((await retry.json()) as { code: string }).code).toBe('AUTH_PENDING_INVALID');
  });

  it('rejects an unknown bridge token', async () => {
    const res = await appFetch(
      jsonRequest('/v1/auth/login-complete', {
        authPendingToken: 'not-a-real-token',
        verifierCandidate: fixtures.verifier(),
      }),
    );

    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe('AUTH_PENDING_INVALID');
  });

  it('sets a 30-day cookie for rememberMe and 7 days without', async () => {
    const email = 'login-remember@example.com';
    await signUp(email);

    const first = await getBridge(email);
    const shortRes = await appFetch(
      jsonRequest('/v1/auth/login-complete', {
        authPendingToken: first.authPendingToken,
        verifierCandidate: fixtures.verifier(),
      }),
    );
    expect(shortRes.headers.get('set-cookie')).toContain('Max-Age=604800');

    const second = await getBridge(email);
    const longRes = await appFetch(
      jsonRequest('/v1/auth/login-complete', {
        authPendingToken: second.authPendingToken,
        verifierCandidate: fixtures.verifier(),
        rememberMe: true,
      }),
    );
    expect(longRes.headers.get('set-cookie')).toContain('Max-Age=2592000');
  });
});

describe('recovery sessions', () => {
  it('skips the verifier check for via=recovery', async () => {
    const email = 'recovery-login@example.com';
    await signUp(email);

    const { authPendingToken } = await getBridge(email);
    const res = await appFetch(
      jsonRequest('/v1/auth/login-complete', { authPendingToken, via: 'recovery' }),
    );

    expect(res.status).toBe(200);
  });

  it('lets a recovery session read the key bundle', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB, { viaRecovery: true });

    const res = await appFetch(authedRequest('/v1/auth/key-bundle', cookie));
    expect(res.status).toBe(200);
  });

  it('refuses a recovery session anywhere else', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB, { viaRecovery: true });

    const res = await appFetch(authedRequest('/v1/vault', cookie));

    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe('RECOVERY_SESSION');
  });

  it('refuses a recovery reset on an ordinary session', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(
      jsonRequest(
        '/v1/auth/recovery-reset',
        {
          newVerifier: fixtures.verifierFields(),
          newUserKeyPwd: {
            wrappedPrivKey: fixtures.wrappedPrivKey(),
            kekSalt: fixtures.salt16(),
            kekKdfKind: 2,
            kekKdfParams: fixtures.argon2Params(),
          },
          newMemberKeyPwd: {
            wrappedMasterKey: fixtures.wrappedMasterKey(),
            kekSalt: fixtures.salt16(),
            kekKdfKind: 2,
            kekKdfParams: fixtures.argon2Params(),
          },
        },
        { cookie },
      ),
    );

    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe('RECOVERY_SESSION_REQUIRED');
  });

  it('replaces the password rows and leaves the recovery rows alone', async () => {
    const email = 'recovery-reset@example.com';
    await signUp(email);

    const { authPendingToken } = await getBridge(email);
    const loginRes = await appFetch(
      jsonRequest('/v1/auth/login-complete', { authPendingToken, via: 'recovery' }),
    );
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0]!;

    const newWrap = fixtures.envelopeA(0x03, 64);
    const res = await appFetch(
      jsonRequest(
        '/v1/auth/recovery-reset',
        {
          newVerifier: fixtures.verifierFields(0xaa),
          newUserKeyPwd: {
            wrappedPrivKey: newWrap,
            kekSalt: fixtures.salt16(0xbb),
            kekKdfKind: 2,
            kekKdfParams: fixtures.argon2Params(),
          },
          newMemberKeyPwd: {
            wrappedMasterKey: fixtures.wrappedMasterKey(),
            kekSalt: fixtures.salt16(0xbb),
            kekKdfKind: 2,
            kekKdfParams: fixtures.argon2Params(),
          },
        },
        { cookie },
      ),
    );

    expect(res.status).toBe(200);

    const bundleRes = await appFetch(authedRequest('/v1/auth/key-bundle', cookie));
    const bundle = (await bundleRes.json()) as {
      userKeys: Array<{ kekKind: string; wrappedPrivKey: string; kekSalt: string | null }>;
    };

    const pwd = bundle.userKeys.find((key) => key.kekKind === 'pwd');
    const recovery = bundle.userKeys.find((key) => key.kekKind === 'recovery');
    expect(pwd?.wrappedPrivKey).toBe(newWrap);
    expect(pwd?.kekSalt).toBe(fixtures.salt16(0xbb));
    // Untouched: the phrase must keep working after a password reset.
    expect(recovery?.wrappedPrivKey).toBe(fixtures.wrappedPrivKey());
    expect(recovery?.kekSalt).toBeNull();
  });
});

describe('POST /auth/rewrap-keys', () => {
  it('replaces the password rows and the verifier together', async () => {
    const email = 'rewrap@example.com';
    const { cookie } = await signUp(email);

    const newPriv = fixtures.envelopeA(0x03, 80);
    const newMaster = fixtures.envelopeA(0x02, 80);

    const res = await appFetch(
      jsonRequest(
        '/v1/auth/rewrap-keys',
        {
          ...fixtures.verifierFields(0xcc),
          newKekSalt: fixtures.salt16(0xdd),
          newKekKdfKind: 2,
          newKekKdfParams: fixtures.argon2Params(),
          newUserKeysPwd: { wrappedPrivKey: newPriv },
          newMemberKeysPwd: { wrappedMasterKey: newMaster },
        },
        { cookie },
      ),
    );

    expect(res.status).toBe(200);

    const bundle = (await (
      await appFetch(authedRequest('/v1/auth/key-bundle', cookie))
    ).json()) as {
      user: { verifierSalt: string };
      userKeys: Array<{ kekKind: string; wrappedPrivKey: string }>;
      memberKeys: Array<{ kekKind: string; wrappedMasterKey: string }>;
    };

    expect(bundle.user.verifierSalt).toBe(fixtures.salt16());
    expect(bundle.userKeys.find((k) => k.kekKind === 'pwd')?.wrappedPrivKey).toBe(newPriv);
    expect(bundle.memberKeys.find((k) => k.kekKind === 'pwd')?.wrappedMasterKey).toBe(newMaster);
  });

  it('rejects a PBKDF2 KDF kind, which is reserved and never written', async () => {
    const { cookie } = await signUp('rewrap-pbkdf2@example.com');

    const res = await appFetch(
      jsonRequest(
        '/v1/auth/rewrap-keys',
        {
          ...fixtures.verifierFields(),
          newKekSalt: fixtures.salt16(),
          newKekKdfKind: 1,
          newKekKdfParams: fixtures.argon2Params(),
          newUserKeysPwd: { wrappedPrivKey: fixtures.wrappedPrivKey() },
          newMemberKeysPwd: { wrappedMasterKey: fixtures.wrappedMasterKey() },
        },
        { cookie },
      ),
    );

    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('INVALID_BLOB');
  });
});

describe('GET /auth/key-bundle', () => {
  it('returns the wrapped material for the authenticated user', async () => {
    const { cookie } = await signUp('bundle@example.com');

    const res = await appFetch(authedRequest('/v1/auth/key-bundle', cookie));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { pubkey: string };
      userKeys: unknown[];
      household: { id: string };
      memberKeys: unknown[];
    };
    expect(body.user.pubkey).toBe(fixtures.pubkey());
    expect(body.userKeys).toHaveLength(2);
    expect(body.memberKeys).toHaveLength(2);
    expect(body.household.id).toBeTruthy();
  });

  it('returns 401 without auth', async () => {
    const res = await appFetch(new Request('http://localhost/v1/auth/key-bundle'));
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns the user and their household', async () => {
    const { user, householdId, cookie } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(authedRequest('/v1/auth/me', cookie));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { id: string };
      household: { id: string } | null;
    };
    expect(body.user.id).toBe(user.id);
    expect(body.household?.id).toBe(householdId);
  });

  it('returns a null household for a user still awaiting a handoff', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB, { withoutHousehold: true });

    const res = await appFetch(authedRequest('/v1/auth/me', cookie));

    expect(res.status).toBe(200);
    expect(((await res.json()) as { household: unknown }).household).toBeNull();
  });

  it('returns 401 without auth', async () => {
    const res = await appFetch(new Request('http://localhost/v1/auth/me'));
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('deletes the session', async () => {
    const { sessionId, cookie } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(authedRequest('/v1/auth/logout', cookie, 'POST'));

    expect(res.status).toBe(200);
    const session = await env.DB
      .prepare('SELECT id FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first();
    expect(session).toBeNull();
  });
});

describe('DELETE /auth/account', () => {
  it('deletes the user, their household and their key rows', async () => {
    const { user, householdId, cookie } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(authedRequest('/v1/auth/account', cookie, 'DELETE'));

    expect(res.status).toBe(200);

    const userRow = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(user.id).first();
    expect(userRow).toBeNull();

    // households has no foreign key to users, so this only goes if the handler removes it.
    const householdRow = await env.DB
      .prepare('SELECT id FROM households WHERE id = ?')
      .bind(householdId)
      .first();
    expect(householdRow).toBeNull();
  });

  it('leaves the household standing when a partner remains', async () => {
    const owner = await createAuthenticatedUser(env.DB);
    const partner = await createAuthenticatedUser(env.DB, {
      joinHouseholdId: owner.householdId!,
    });

    const res = await appFetch(authedRequest('/v1/auth/account', partner.cookie, 'DELETE'));
    expect(res.status).toBe(200);

    const householdRow = await env.DB
      .prepare('SELECT id FROM households WHERE id = ?')
      .bind(owner.householdId)
      .first();
    expect(householdRow).not.toBeNull();
  });
});

describe('session management', () => {
  it('revokes all sessions except the current one', async () => {
    const { user, sessionId, cookie } = await createAuthenticatedUser(env.DB);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    for (const extra of [generateId(), generateId()]) {
      await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
        .bind(extra, user.id, expiresAt)
        .run();
    }

    const res = await appFetch(authedRequest('/v1/auth/revoke-all-sessions', cookie, 'POST'));

    expect(res.status).toBe(200);
    expect(((await res.json()) as { revoked: number }).revoked).toBe(2);

    const current = await env.DB
      .prepare('SELECT id FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first();
    expect(current).not.toBeNull();
  });

  it('lists sessions and marks the current one', async () => {
    const { user, sessionId, cookie } = await createAuthenticatedUser(env.DB);

    const extra = generateId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(extra, user.id, expiresAt)
      .run();

    const res = await appFetch(authedRequest('/v1/auth/sessions', cookie));

    const body = (await res.json()) as { sessions: Array<{ id: string; isCurrent: boolean }> };
    expect(body.sessions).toHaveLength(2);
    expect(body.sessions.find((s) => s.id === sessionId)?.isCurrent).toBe(true);
    expect(body.sessions.find((s) => s.id === extra)?.isCurrent).toBe(false);
  });

  it('does not leak another user\'s sessions', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const { sessionId: otherSessionId } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(authedRequest('/v1/auth/sessions', cookie));

    const body = (await res.json()) as { sessions: Array<{ id: string }> };
    expect(body.sessions.map((s) => s.id)).not.toContain(otherSessionId);
  });

  it('refuses to revoke the current session', async () => {
    const { sessionId, cookie } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(authedRequest(`/v1/auth/sessions/${sessionId}`, cookie, 'DELETE'));
    expect(res.status).toBe(400);
  });

  it('returns 404 for another user\'s session', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const { sessionId: otherSessionId } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(
      authedRequest(`/v1/auth/sessions/${otherSessionId}`, cookie, 'DELETE'),
    );
    expect(res.status).toBe(404);
  });
});

describe('auth bypass attempts', () => {
  it('rejects a JWT signed with the wrong secret', async () => {
    const { user, sessionId } = await createAuthenticatedUser(env.DB);
    const forged = await jwtSign(
      { sub: user.id, sid: sessionId, email: user.email },
      'wrong-secret-key',
      7 * 24 * 60 * 60,
    );

    const res = await appFetch(
      new Request('http://localhost/v1/auth/me', {
        headers: { Cookie: `${COOKIE_NAME}=${forged}` },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects a tampered JWT payload', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const parts = cookie.split('=')[1]!.split('.');
    parts[1] = parts[1]!.slice(0, -3) + 'xxx';

    const res = await appFetch(
      new Request('http://localhost/v1/auth/me', {
        headers: { Cookie: `${COOKIE_NAME}=${parts.join('.')}` },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects an expired JWT', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB, { jwtExpiry: -1 });

    const res = await appFetch(authedRequest('/v1/auth/me', cookie));
    expect(res.status).toBe(401);
  });

  it('rejects a valid signature over a session that does not exist', async () => {
    const { user } = await createAuthenticatedUser(env.DB);
    const token = await jwtSign(
      { sub: user.id, sid: generateId(), email: user.email },
      env.JWT_SECRET,
      7 * 24 * 60 * 60,
    );

    const res = await appFetch(
      new Request('http://localhost/v1/auth/me', {
        headers: { Cookie: `${COOKIE_NAME}=${token}` },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('does not let a forged hid claim scope the vault to another household', async () => {
    const victim = await createAuthenticatedUser(env.DB);
    const attacker = await createAuthenticatedUser(env.DB);

    // A token the attacker could not actually mint, standing in for a server that
    // trusted the claim: the household is resolved from household_members regardless.
    const forged = await jwtSign(
      {
        sub: attacker.user.id,
        sid: attacker.sessionId,
        email: attacker.user.email,
        hid: victim.householdId!,
      },
      env.JWT_SECRET,
      7 * 24 * 60 * 60,
    );

    const res = await appFetch(
      new Request('http://localhost/v1/vault/history', {
        headers: { Cookie: `${COOKIE_NAME}=${forged}` },
      }),
    );

    expect(res.status).toBe(200);
    // Empty because scoping came from the attacker's own membership, not the claim.
    expect(((await res.json()) as { versions: unknown[] }).versions).toEqual([]);
  });
});

describe('session rotation on JWT renewal', () => {
  it('rotates the session id and keeps the household claim', async () => {
    const { user, sessionId, householdId, cookie } = await createAuthenticatedUser(env.DB, {
      jwtExpiry: 3 * 24 * 60 * 60, // below the 3.5-day renewal threshold
    });

    const res = await appFetch(authedRequest('/v1/auth/me', cookie));
    expect(res.status).toBe(200);

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('__budget_session=');

    const oldSession = await env.DB
      .prepare('SELECT id FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first();
    expect(oldSession).toBeNull();

    // The rotated token must still carry hid, or the next request loses its scope.
    const rotated = setCookie!.split(';')[0]!.split('=')[1]!;
    const payload = JSON.parse(atob(rotated.split('.')[1]!)) as { hid?: string; sub: string };
    expect(payload.hid).toBe(householdId);
    expect(payload.sub).toBe(user.id);
  });
});
