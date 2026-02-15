import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { applyMigrations, createAuthenticatedUser, jsonRequest, appFetch, COOKIE_NAME } from '../helpers/setup.js';
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

/** Extract the auth code captured by the email mock from the most recent call. */
function getCapturedCode(): string {
  const code = mockSendAuthCode.mock.lastCall?.[3];
  if (!code) throw new Error('sendAuthCode was not called');
  return code;
}

describe('POST /auth/login', () => {
  it('sends a 6-digit auth code for valid email', async () => {
    const res = await appFetch(jsonRequest('/auth/login', { email: 'user@example.com' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Code sent' });
    expect(mockSendAuthCode).toHaveBeenCalledOnce();
    expect(getCapturedCode()).toMatch(/^\d{6}$/);
  });

  it('rejects invalid email format', async () => {
    const res = await appFetch(jsonRequest('/auth/login', { email: 'not-an-email' }));

    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('BAD_REQUEST');
  });

  it('rejects missing email', async () => {
    const res = await appFetch(jsonRequest('/auth/login', {}));

    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('BAD_REQUEST');
  });

  it('rejects wrong content-type', async () => {
    const res = await appFetch(
      new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'email=user@example.com',
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('BAD_REQUEST');
  });
});

describe('POST /auth/verify', () => {
  it('verifies correct code and returns user with Set-Cookie', async () => {
    const email = 'verify-ok@example.com';
    await appFetch(jsonRequest('/auth/login', { email }));
    const code = getCapturedCode();

    const res = await appFetch(jsonRequest('/auth/verify', { email, code }));

    expect(res.status).toBe(200);
    const body = await res.json() as { user: { id: string; email: string } };
    expect(body.user.email).toBe(email);
    expect(body.user.id).toBeTruthy();
    expect(res.headers.get('set-cookie')).toContain('__budget_session=');
  });

  it('rejects wrong code', async () => {
    const email = 'verify-bad@example.com';
    await appFetch(jsonRequest('/auth/login', { email }));

    const res = await appFetch(jsonRequest('/auth/verify', { email, code: '000000' }));

    expect(res.status).toBe(401);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('rejects missing code', async () => {
    const res = await appFetch(jsonRequest('/auth/verify', { email: 'a@b.com' }));
    expect(res.status).toBe(400);
  });

  it('rejects missing email', async () => {
    const res = await appFetch(jsonRequest('/auth/verify', { code: '123456' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /auth/me', () => {
  it('returns user when authenticated', async () => {
    const { user, cookie } = await createAuthenticatedUser(env.DB);
    const res = await appFetch(
      new Request('http://localhost/auth/me', { headers: { Cookie: cookie } }),
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { user: { id: string; email: string } };
    expect(body.user.id).toBe(user.id);
    expect(body.user.email).toBe(user.email);
  });

  it('returns 401 without auth', async () => {
    const res = await appFetch(new Request('http://localhost/auth/me'));

    expect(res.status).toBe(401);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /auth/logout', () => {
  it('deletes the session from the database', async () => {
    const { sessionId, cookie } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(
      new Request('http://localhost/auth/logout', {
        method: 'POST',
        headers: { Cookie: cookie },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Logged out' });

    const session = await env.DB
      .prepare('SELECT id FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first();
    expect(session).toBeNull();
  });
});

describe('DELETE /auth/account', () => {
  it('deletes user and all associated data', async () => {
    const { user, cookie } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(
      new Request('http://localhost/auth/account', {
        method: 'DELETE',
        headers: { Cookie: cookie },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Account deleted' });

    const row = await env.DB
      .prepare('SELECT id FROM users WHERE id = ?')
      .bind(user.id)
      .first();
    expect(row).toBeNull();
  });
});

describe('full auth flow', () => {
  it('login → verify → me → logout → me returns 401', async () => {
    const email = 'fullflow@example.com';

    // Login
    const loginRes = await appFetch(jsonRequest('/auth/login', { email }));
    expect(loginRes.status).toBe(200);
    const code = getCapturedCode();

    // Verify
    const verifyRes = await appFetch(jsonRequest('/auth/verify', { email, code }));
    expect(verifyRes.status).toBe(200);
    const cookie = verifyRes.headers.get('set-cookie')!.split(';')[0];

    // Me
    const meRes = await appFetch(
      new Request('http://localhost/auth/me', { headers: { Cookie: cookie } }),
    );
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json() as { user: { email: string } };
    expect(meBody.user.email).toBe(email);

    // Logout
    const logoutRes = await appFetch(
      new Request('http://localhost/auth/logout', {
        method: 'POST',
        headers: { Cookie: cookie },
      }),
    );
    expect(logoutRes.status).toBe(200);

    // Me after logout should fail
    const meAfterRes = await appFetch(
      new Request('http://localhost/auth/me', { headers: { Cookie: cookie } }),
    );
    expect(meAfterRes.status).toBe(401);
  });
});

describe('POST /auth/verify (rememberMe)', () => {
  it('default verify sets 7-day cookie maxAge', async () => {
    const email = 'remember-default@example.com';
    await appFetch(jsonRequest('/auth/login', { email }));
    const code = getCapturedCode();

    const res = await appFetch(jsonRequest('/auth/verify', { email, code }));
    expect(res.status).toBe(200);

    const setCookieHeader = res.headers.get('set-cookie')!;
    expect(setCookieHeader).toContain('Max-Age=604800');
  });

  it('rememberMe=true sets 30-day cookie maxAge', async () => {
    const email = 'remember-true@example.com';
    await appFetch(jsonRequest('/auth/login', { email }));
    const code = getCapturedCode();

    const res = await appFetch(jsonRequest('/auth/verify', { email, code, rememberMe: true }));
    expect(res.status).toBe(200);

    const setCookieHeader = res.headers.get('set-cookie')!;
    expect(setCookieHeader).toContain('Max-Age=2592000');
  });
});

describe('POST /auth/revoke-all-sessions', () => {
  it('revokes all sessions except current', async () => {
    const { user, sessionId, cookie } = await createAuthenticatedUser(env.DB);

    // Create 2 extra sessions directly in DB
    const extra1 = generateId();
    const extra2 = generateId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(extra1, user.id, expiresAt).run();
    await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(extra2, user.id, expiresAt).run();

    const res = await appFetch(
      new Request('http://localhost/auth/revoke-all-sessions', {
        method: 'POST',
        headers: { Cookie: cookie },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { revoked: number };
    expect(body.revoked).toBe(2);

    // Current session should still exist
    const current = await env.DB.prepare('SELECT id FROM sessions WHERE id = ?')
      .bind(sessionId).first();
    expect(current).not.toBeNull();

    // Extra sessions should be gone
    const e1 = await env.DB.prepare('SELECT id FROM sessions WHERE id = ?').bind(extra1).first();
    const e2 = await env.DB.prepare('SELECT id FROM sessions WHERE id = ?').bind(extra2).first();
    expect(e1).toBeNull();
    expect(e2).toBeNull();
  });

  it('returns revoked: 0 when no other sessions', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(
      new Request('http://localhost/auth/revoke-all-sessions', {
        method: 'POST',
        headers: { Cookie: cookie },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { revoked: number };
    expect(body.revoked).toBe(0);
  });

  it('returns 401 without auth', async () => {
    const res = await appFetch(
      new Request('http://localhost/auth/revoke-all-sessions', { method: 'POST' }),
    );
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/sessions', () => {
  it('lists all sessions and marks current', async () => {
    const { user, sessionId, cookie } = await createAuthenticatedUser(env.DB);

    // Add an extra session
    const extra = generateId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(extra, user.id, expiresAt).run();

    const res = await appFetch(
      new Request('http://localhost/auth/sessions', { headers: { Cookie: cookie } }),
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { sessions: Array<{ id: string; createdAt: string; isCurrent: boolean }> };
    expect(body.sessions.length).toBe(2);

    const current = body.sessions.find((s) => s.id === sessionId);
    const other = body.sessions.find((s) => s.id === extra);
    expect(current?.isCurrent).toBe(true);
    expect(other?.isCurrent).toBe(false);
  });

  it('does not leak other users sessions', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const { sessionId: otherSessionId } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(
      new Request('http://localhost/auth/sessions', { headers: { Cookie: cookie } }),
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { sessions: Array<{ id: string }> };
    const ids = body.sessions.map((s) => s.id);
    expect(ids).not.toContain(otherSessionId);
  });

  it('returns 401 without auth', async () => {
    const res = await appFetch(new Request('http://localhost/auth/sessions'));
    expect(res.status).toBe(401);
  });
});

describe('DELETE /auth/sessions/:id', () => {
  it('revokes a specific session', async () => {
    const { user, cookie } = await createAuthenticatedUser(env.DB);

    const extra = generateId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(extra, user.id, expiresAt).run();

    const res = await appFetch(
      new Request(`http://localhost/auth/sessions/${extra}`, {
        method: 'DELETE',
        headers: { Cookie: cookie },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Session revoked' });

    const row = await env.DB.prepare('SELECT id FROM sessions WHERE id = ?').bind(extra).first();
    expect(row).toBeNull();
  });

  it('rejects revoking current session with 400', async () => {
    const { sessionId, cookie } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(
      new Request(`http://localhost/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Cookie: cookie },
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('BAD_REQUEST');
  });

  it('returns 404 for nonexistent session', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(
      new Request(`http://localhost/auth/sessions/${generateId()}`, {
        method: 'DELETE',
        headers: { Cookie: cookie },
      }),
    );

    expect(res.status).toBe(404);
  });

  it('returns 404 for other users session', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const { sessionId: otherSessionId } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(
      new Request(`http://localhost/auth/sessions/${otherSessionId}`, {
        method: 'DELETE',
        headers: { Cookie: cookie },
      }),
    );

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await appFetch(
      new Request(`http://localhost/auth/sessions/${generateId()}`, { method: 'DELETE' }),
    );
    expect(res.status).toBe(401);
  });
});

describe('auth bypass attempts', () => {
  it('rejects a JWT signed with the wrong secret', async () => {
    const { user, sessionId } = await createAuthenticatedUser(env.DB);
    const forgedToken = await jwtSign(
      { sub: user.id, sid: sessionId, email: user.email },
      'wrong-secret-key',
      7 * 24 * 60 * 60,
    );

    const res = await appFetch(
      new Request('http://localhost/auth/me', {
        headers: { Cookie: `${COOKIE_NAME}=${forgedToken}` },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects a tampered JWT payload', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    // Corrupt the payload section (second part) of the JWT
    const token = cookie.split('=')[1];
    const parts = token.split('.');
    parts[1] = parts[1].slice(0, -3) + 'xxx';
    const tamperedCookie = `${COOKIE_NAME}=${parts.join('.')}`;

    const res = await appFetch(
      new Request('http://localhost/auth/me', {
        headers: { Cookie: tamperedCookie },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects an expired JWT', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB, {
      jwtExpiry: -1, // already expired
    });

    const res = await appFetch(
      new Request('http://localhost/auth/me', {
        headers: { Cookie: cookie },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects a JWT with a valid signature but nonexistent session', async () => {
    const userId = generateId();
    const email = `nosession-${userId.slice(0, 8)}@example.com`;
    const now = new Date().toISOString();
    await env.DB.prepare('INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .bind(userId, email, now, now).run();

    const token = await jwtSign(
      { sub: userId, sid: generateId(), email },
      env.JWT_SECRET,
      7 * 24 * 60 * 60,
    );

    const res = await appFetch(
      new Request('http://localhost/auth/me', {
        headers: { Cookie: `${COOKIE_NAME}=${token}` },
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe('session rotation on JWT renewal', () => {
  it('rotates session ID when JWT is past renewal threshold', async () => {
    // Create user with a JWT that expires in 3 days (below the 3.5-day threshold)
    const { user, sessionId, cookie } = await createAuthenticatedUser(env.DB, {
      jwtExpiry: 3 * 24 * 60 * 60, // 3 days — below the 3.5-day renewal threshold
    });

    const res = await appFetch(
      new Request('http://localhost/auth/me', { headers: { Cookie: cookie } }),
    );

    expect(res.status).toBe(200);

    // Should have a Set-Cookie header (renewal happened)
    const setCookieHeader = res.headers.get('set-cookie');
    expect(setCookieHeader).toBeTruthy();
    expect(setCookieHeader).toContain('__budget_session=');

    // Old session should be deleted
    const oldSession = await env.DB.prepare('SELECT id FROM sessions WHERE id = ?')
      .bind(sessionId).first();
    expect(oldSession).toBeNull();

    // New session should exist for this user
    const newSessions = await env.DB
      .prepare('SELECT id FROM sessions WHERE user_id = ?')
      .bind(user.id)
      .all<{ id: string }>();
    expect(newSessions.results.length).toBeGreaterThanOrEqual(1);

    // The new session should have a different ID
    const newSessionIds = newSessions.results.map((r) => r.id);
    expect(newSessionIds).not.toContain(sessionId);
  });
});
