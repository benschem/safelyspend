import { setCookie, deleteCookie } from 'hono/cookie';
import { jwtSign } from './crypto.js';
import type { AppContext } from '../types.js';

export const COOKIE_NAME = '__budget_session';

/** How long a signed token stays valid. Fixed, and deliberately independent of the
 *  session lifetimes below: a remembered session outlives any one token and is carried
 *  across by the renewal-and-rotation in middleware/auth.ts. */
export const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

/** How long the server-side session row and the cookie live. This is what remember-me
 *  stretches, not the token lifetime. */
export const SESSION_EXPIRY_DEFAULT = 7 * 24 * 60 * 60;
export const SESSION_EXPIRY_REMEMBER = 30 * 24 * 60 * 60;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
  path: '/',
} as const;

export function sessionLifetimeSeconds(rememberMe: boolean | undefined): number {
  return rememberMe ? SESSION_EXPIRY_REMEMBER : SESSION_EXPIRY_DEFAULT;
}

export interface SessionClaims {
  userId: string;
  sessionId: string;
  email: string;
  householdId: string | null;
  /** Session came from the recovery path, so no password verifier was checked. */
  viaRecovery?: boolean;
}

/** Sign the session JWT and attach it as the session cookie.
 *
 *  The JWT lifetime and the client's in-memory MasterKey lifetime are independent
 *  (Q6): nothing here touches the key, and clearing the key does not touch this. */
export async function issueSessionCookie(
  c: AppContext,
  claims: SessionClaims,
  lifetimeSeconds: number,
): Promise<void> {
  const token = await jwtSign(
    {
      sub: claims.userId,
      sid: claims.sessionId,
      email: claims.email,
      ...(claims.householdId ? { hid: claims.householdId } : {}),
      ...(claims.viaRecovery ? { rec: true } : {}),
    },
    c.env.JWT_SECRET,
    JWT_EXPIRY_SECONDS,
  );

  setCookie(c, COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: lifetimeSeconds });
}

export function clearSessionCookie(c: AppContext): void {
  deleteCookie(c, COOKIE_NAME, COOKIE_OPTIONS);
}
