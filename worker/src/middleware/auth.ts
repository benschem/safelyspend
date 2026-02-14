import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { jwtVerify } from '../lib/crypto.js';
import { unauthorized } from '../lib/errors.js';
import { findBySession } from '../services/users.js';
import type { HonoEnv } from '../types.js';

const COOKIE_NAME = '__budget_session';

export const authMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const token = getCookie(c, COOKIE_NAME);

  if (!token) {
    throw unauthorized('Authentication required');
  }

  const payload = await jwtVerify(token, c.env.JWT_SECRET);

  if (!payload.sid) {
    throw unauthorized('Invalid session');
  }

  const user = await findBySession(c.env.DB, payload.sub, payload.sid);
  if (!user) {
    throw unauthorized('Session expired or invalid');
  }

  c.set('user', user);
  c.set('jwtPayload', payload);

  await next();
});
