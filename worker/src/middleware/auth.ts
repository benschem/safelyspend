import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { jwtVerify } from '../lib/crypto.js';
import { unauthorized } from '../lib/errors.js';
import { findById } from '../services/users.js';
import type { HonoEnv } from '../types.js';

const COOKIE_NAME = '__budget_session';

export const authMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const token = getCookie(c, COOKIE_NAME);

  if (!token) {
    throw unauthorized('Authentication required');
  }

  const payload = await jwtVerify(token, c.env.JWT_SECRET);

  const user = await findById(c.env.DB, payload.sub);
  if (!user) {
    throw unauthorized('User not found');
  }

  c.set('user', user);
  c.set('jwtPayload', payload);

  await next();
});
