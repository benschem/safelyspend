import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { jwtSign } from '../lib/crypto.js';
import { badRequest, notFound, unauthorized } from '../lib/errors.js';
import { findByEmail, create, deleteUser } from '../services/users.js';
import { createAuthCode, verifyAuthCode, cleanupExpiredCodes } from '../services/auth.js';
import { sendAuthCode } from '../services/email.js';
import { deleteAllForUser } from '../services/vault.js';
import type { HonoEnv } from '../types.js';

const COOKIE_NAME = '__budget_session';
const JWT_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limiters
const loginRateLimit = rateLimit({ max: 5, windowSeconds: 60, keyPrefix: 'auth:login' });
const verifyRateLimit = rateLimit({ max: 10, windowSeconds: 60, keyPrefix: 'auth:verify' });

const auth = new Hono<HonoEnv>();

// POST /auth/login
auth.post('/login', loginRateLimit, async (c) => {
  const body = await c.req.json<{ email?: string }>();

  if (!body.email || typeof body.email !== 'string') {
    throw badRequest('Email is required');
  }

  const email = body.email.toLowerCase().trim();

  if (!EMAIL_REGEX.test(email)) {
    throw badRequest('Invalid email format');
  }

  // Find or create user
  let user = await findByEmail(c.env.DB, email);
  if (!user) {
    user = await create(c.env.DB, email);
  }

  // Create auth code
  const code = await createAuthCode(c.env.DB, user.id);

  // Send email
  await sendAuthCode(c.env.RESEND_API_KEY, c.env.FROM_EMAIL, email, code);

  // Cleanup expired codes in background
  c.executionCtx.waitUntil(cleanupExpiredCodes(c.env.DB));

  return c.json({ message: 'Code sent' });
});

// POST /auth/verify
auth.post('/verify', verifyRateLimit, async (c) => {
  const body = await c.req.json<{ email?: string; code?: string }>();

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
    throw notFound('User not found');
  }

  const valid = await verifyAuthCode(c.env.DB, user.id, code);
  if (!valid) {
    throw unauthorized('Invalid or expired code');
  }

  // Sign JWT
  const token = await jwtSign(
    { sub: user.id, email: user.email },
    c.env.JWT_SECRET,
    JWT_EXPIRY_SECONDS,
  );

  // Set cookie
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });

  return c.json({ user: { id: user.id, email: user.email } });
});

// POST /auth/logout (requires auth)
auth.post('/logout', authMiddleware, async (c) => {
  deleteCookie(c, COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
  });

  return c.json({ message: 'Logged out' });
});

// GET /auth/me (requires auth)
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({ user: { id: user.id, email: user.email } });
});

// DELETE /auth/account (requires auth)
auth.delete('/account', authMiddleware, async (c) => {
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

  return c.json({ message: 'Account deleted' });
});

export default auth;
