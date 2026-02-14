import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { applyMigrations, createAuthenticatedUser, jsonRequest, appFetch } from '../helpers/setup.js';
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
