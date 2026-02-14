import { createMiddleware } from 'hono/factory';
import { getCookie, setCookie } from 'hono/cookie';
import { jwtVerify, jwtSign } from '../lib/crypto.js';
import { unauthorized } from '../lib/errors.js';
import { findBySession } from '../services/users.js';
import type { HonoEnv } from '../types.js';

const COOKIE_NAME = '__budget_session';
const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
const JWT_RENEWAL_THRESHOLD = JWT_EXPIRY_SECONDS / 2; // 3.5 days
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

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
    const newToken = await jwtSign(
      { sub: user.id, sid: payload.sid, email: user.email },
      c.env.JWT_SECRET,
      JWT_EXPIRY_SECONDS,
    );
    setCookie(c, COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
    console.log(JSON.stringify({ event: 'jwt_renewed', userId: user.id }));
  }

  await next();
});
