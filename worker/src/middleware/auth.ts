import { createMiddleware } from 'hono/factory';
import { getCookie, setCookie } from 'hono/cookie';
import { jwtVerify, jwtSign } from '../lib/crypto.js';
import { unauthorized } from '../lib/errors.js';
import { findBySession, getSessionExpiresAt, rotateSession } from '../services/users.js';
import type { HonoEnv } from '../types.js';

const COOKIE_NAME = '__budget_session';
const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
const JWT_RENEWAL_THRESHOLD = JWT_EXPIRY_SECONDS / 2; // 3.5 days

export const authMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const token = getCookie(c, COOKIE_NAME);

  if (!token) {
    console.warn(JSON.stringify({ event: 'auth_failed', reason: 'no_token' }));
    throw unauthorized('Authentication required');
  }

  const payload = await jwtVerify(token, c.env.JWT_SECRET);

  if (!payload.sid) {
    console.warn(JSON.stringify({ event: 'auth_failed', reason: 'invalid_session' }));
    throw unauthorized('Invalid session');
  }

  const user = await findBySession(c.env.DB, payload.sub, payload.sid);
  if (!user) {
    console.warn(JSON.stringify({ event: 'auth_failed', reason: 'session_expired' }));
    throw unauthorized('Session expired or invalid');
  }

  c.set('user', user);
  c.set('jwtPayload', payload);

  // Renew JWT if past halfway through its lifetime
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = payload.exp - now;

  if (timeUntilExpiry < JWT_RENEWAL_THRESHOLD) {
    // Look up session expiry and rotate session ID
    const expiresAt = await getSessionExpiresAt(c.env.DB, payload.sid);
    if (expiresAt) {
      const newSessionId = await rotateSession(c.env.DB, payload.sid, user.id, expiresAt);
      const remainingSeconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));

      const newToken = await jwtSign(
        { sub: user.id, sid: newSessionId, email: user.email },
        c.env.JWT_SECRET,
        JWT_EXPIRY_SECONDS,
      );
      setCookie(c, COOKIE_NAME, newToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        path: '/',
        maxAge: remainingSeconds,
      });

      // Update context so downstream handlers see the new session ID
      c.set('jwtPayload', { ...payload, sid: newSessionId });

      console.log(JSON.stringify({ event: 'session_rotated', userId: user.id }));
    }
  }

  await next();
});
