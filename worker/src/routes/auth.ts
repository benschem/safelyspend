import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimit, checkRateLimit } from '../middleware/rate-limit.js';
import { jwtSign } from '../lib/crypto.js';
import { badRequest, notFound, tooManyRequests, unauthorized } from '../lib/errors.js';
import {
  findByEmail,
  create,
  deleteUser,
  createSession,
  deleteSession,
  deleteAllSessionsExcept,
  listSessions,
  deleteSessionForUser,
  cleanupExpiredSessions,
} from '../services/users.js';
import { createAuthCode, verifyAuthCode, cleanupExpiredCodes, isUserLockedOut } from '../services/auth.js';
import { sendAuthCode } from '../services/email.js';
import { deleteAllForUser } from '../services/vault.js';
import type { HonoEnv, AppContext } from '../types.js';

const COOKIE_NAME = '__budget_session';
const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
const SESSION_EXPIRY_DEFAULT = 7 * 24 * 60 * 60; // 7 days
const SESSION_EXPIRY_REMEMBER = 30 * 24 * 60 * 60; // 30 days

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limiters
const loginRateLimit = rateLimit({ max: 5, windowSeconds: 60, keyPrefix: 'auth:login' });
const verifyRateLimit = rateLimit({ max: 10, windowSeconds: 60, keyPrefix: 'auth:verify' });
const sessionRateLimit = rateLimit({ max: 30, windowSeconds: 60, keyPrefix: 'auth:session' });

const MAX_JSON_SIZE = 1024; // 1KB — sufficient for email + code

const auth = new Hono<HonoEnv>();

// Validate Content-Type and body size for JSON endpoints
async function parseJsonBody<T>(c: AppContext): Promise<T> {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw badRequest('Content-Type must be application/json');
  }

  // Fast reject via Content-Length header
  const contentLength = parseInt(c.req.header('content-length') ?? '0', 10);
  if (contentLength > MAX_JSON_SIZE) {
    throw badRequest('Request body too large');
  }

  // Defense in depth: check actual body size
  const text = await c.req.text();
  if (text.length > MAX_JSON_SIZE) {
    throw badRequest('Request body too large');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw badRequest('Invalid JSON');
  }
}

// POST /auth/login
auth.post('/login', loginRateLimit, async (c) => {
  const body = await parseJsonBody<{ email?: string }>(c);

  if (!body.email || typeof body.email !== 'string') {
    throw badRequest('Email is required');
  }

  const email = body.email.toLowerCase().trim();

  if (!EMAIL_REGEX.test(email)) {
    throw badRequest('Invalid email format');
  }

  // Per-email rate limit: 3 code requests per 15 minutes
  const emailResult = await checkRateLimit(c.env.DB, `auth:login:email:${email}`, 3, 900);
  if (!emailResult.allowed) {
    c.header('Retry-After', String(emailResult.retryAfter));
    throw tooManyRequests('Too many login requests. Please try again later.');
  }

  // Find or create user
  let user = await findByEmail(c.env.DB, email);
  if (!user) {
    user = await create(c.env.DB, email);
  }

  // Check lockout — return 200 silently to prevent email enumeration
  const lockedOut = await isUserLockedOut(c.env.DB, user.id);
  if (lockedOut) {
    console.warn(JSON.stringify({ event: 'user_locked_out', requestId: c.get('requestId'), userId: user.id }));
    return c.json({ message: 'Code sent' });
  }

  // Create auth code
  const code = await createAuthCode(c.env.DB, user.id);

  // Send email
  await sendAuthCode(c.env.RESEND_API_KEY, c.env.FROM_EMAIL, email, code);

  console.log(JSON.stringify({ event: 'login_code_sent', requestId: c.get('requestId') }));

  // Cleanup expired codes and sessions in background
  const requestId = c.get('requestId');
  c.executionCtx.waitUntil(
    Promise.all([
      cleanupExpiredCodes(c.env.DB).catch((err) => console.error(JSON.stringify({
        event: 'background_task_failed',
        requestId,
        task: 'code_cleanup',
        error: err instanceof Error ? err.message : 'Unknown error',
      }))),
      cleanupExpiredSessions(c.env.DB).catch((err) => console.error(JSON.stringify({
        event: 'background_task_failed',
        requestId,
        task: 'session_cleanup',
        error: err instanceof Error ? err.message : 'Unknown error',
      }))),
    ]),
  );

  return c.json({ message: 'Code sent' });
});

// POST /auth/verify
auth.post('/verify', verifyRateLimit, async (c) => {
  const body = await parseJsonBody<{ email?: string; code?: string; rememberMe?: boolean }>(c);

  if (!body.email || typeof body.email !== 'string') {
    throw badRequest('Email is required');
  }
  if (!body.code || typeof body.code !== 'string') {
    throw badRequest('Code is required');
  }

  const email = body.email.toLowerCase().trim();
  const code = body.code.trim();

  const user = await findByEmail(c.env.DB, email);
  if (!user) {
    throw unauthorized('Invalid email or code');
  }

  // Per-user verification rate limit: 10 attempts per 15 minutes
  const verifyResult = await checkRateLimit(c.env.DB, `auth:verify:user:${user.id}`, 10, 900);
  if (!verifyResult.allowed) {
    c.header('Retry-After', String(verifyResult.retryAfter));
    throw tooManyRequests('Too many verification attempts. Please try again later.');
  }

  const valid = await verifyAuthCode(c.env.DB, user.id, code);
  if (!valid) {
    throw unauthorized('Invalid email or code');
  }

  // Create session
  const sessionExpiry = body.rememberMe ? SESSION_EXPIRY_REMEMBER : SESSION_EXPIRY_DEFAULT;
  const sessionExpiresAt = new Date(Date.now() + sessionExpiry * 1000).toISOString();
  const sessionId = await createSession(c.env.DB, user.id, sessionExpiresAt);

  // Sign JWT with session ID
  const token = await jwtSign(
    { sub: user.id, sid: sessionId, email: user.email },
    c.env.JWT_SECRET,
    JWT_EXPIRY_SECONDS,
  );

  // Set cookie
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: sessionExpiry,
  });

  console.log(JSON.stringify({ event: 'auth_verified', requestId: c.get('requestId'), userId: user.id }));

  return c.json({ user: { id: user.id, email: user.email } });
});

// POST /auth/logout (requires auth)
auth.post('/logout', authMiddleware, sessionRateLimit, async (c) => {
  const payload = c.get('jwtPayload');
  await deleteSession(c.env.DB, payload.sid);

  deleteCookie(c, COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
  });

  console.log(JSON.stringify({ event: 'logout', requestId: c.get('requestId'), userId: payload.sub }));

  return c.json({ message: 'Logged out' });
});

// GET /auth/me (requires auth)
auth.get('/me', authMiddleware, sessionRateLimit, async (c) => {
  const user = c.get('user');
  return c.json({ user: { id: user.id, email: user.email } });
});

// DELETE /auth/account (requires auth)
auth.delete('/account', authMiddleware, sessionRateLimit, async (c) => {
  const user = c.get('user');

  // Delete all vaults + R2 objects
  await deleteAllForUser(c.env.DB, c.env.VAULT_BUCKET, user.id);

  // Delete user (cascade handles auth_codes, sync_state)
  await deleteUser(c.env.DB, user.id);

  // Delete cookie
  deleteCookie(c, COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
  });

  console.log(JSON.stringify({ event: 'account_deleted', requestId: c.get('requestId'), userId: user.id }));

  return c.json({ message: 'Account deleted' });
});

// POST /auth/revoke-all-sessions (requires auth)
auth.post('/revoke-all-sessions', authMiddleware, sessionRateLimit, async (c) => {
  const payload = c.get('jwtPayload');
  const revoked = await deleteAllSessionsExcept(c.env.DB, payload.sub, payload.sid);

  console.log(JSON.stringify({ event: 'sessions_revoked', requestId: c.get('requestId'), userId: payload.sub, count: revoked }));

  return c.json({ revoked });
});

// GET /auth/sessions (requires auth)
auth.get('/sessions', authMiddleware, sessionRateLimit, async (c) => {
  const payload = c.get('jwtPayload');
  const sessions = await listSessions(c.env.DB, payload.sub);

  return c.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      isCurrent: s.id === payload.sid,
    })),
  });
});

// DELETE /auth/sessions/:id (requires auth)
auth.delete('/sessions/:id', authMiddleware, sessionRateLimit, async (c) => {
  const payload = c.get('jwtPayload');
  const sessionId = c.req.param('id');

  if (sessionId === payload.sid) {
    throw badRequest('Cannot revoke current session. Use logout instead.');
  }

  const deleted = await deleteSessionForUser(c.env.DB, sessionId, payload.sub);
  if (!deleted) {
    throw notFound('Session not found');
  }

  console.log(JSON.stringify({ event: 'session_revoked', requestId: c.get('requestId'), userId: payload.sub, sessionId }));

  return c.json({ message: 'Session revoked' });
});

export default auth;
