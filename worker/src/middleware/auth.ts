import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { jwtVerify } from '../lib/crypto.js';
import { coded, unauthorized } from '../lib/errors.js';
import { COOKIE_NAME, JWT_EXPIRY_SECONDS, issueSessionCookie } from '../lib/session.js';
import { findBySession, getSessionExpiresAt, rotateSession } from '../services/users.js';
import type { HonoEnv } from '../types.js';

/** Renew once the token is past halfway through its life. */
const JWT_RENEWAL_THRESHOLD = JWT_EXPIRY_SECONDS / 2; // 3.5 days

export const authMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const requestId = c.get('requestId');
  const token = getCookie(c, COOKIE_NAME);

  if (!token) {
    console.warn(JSON.stringify({ event: 'auth_failed', requestId, reason: 'no_token' }));
    throw unauthorized('Authentication required');
  }

  let payload;
  try {
    payload = await jwtVerify(token, c.env.JWT_SECRET);
  } catch (err) {
    // Fall back to previous secret during key rotation
    if (c.env.JWT_SECRET_PREVIOUS) {
      payload = await jwtVerify(token, c.env.JWT_SECRET_PREVIOUS);
    } else {
      throw err;
    }
  }

  if (!payload.sid) {
    console.warn(JSON.stringify({ event: 'auth_failed', requestId, reason: 'invalid_session' }));
    throw unauthorized('Invalid session');
  }

  const session = await findBySession(c.env.DB, payload.sub, payload.sid);
  if (!session) {
    console.warn(JSON.stringify({ event: 'auth_failed', requestId, userId: payload.sub, reason: 'session_expired' }));
    throw unauthorized('Session expired or invalid');
  }

  const { user, householdId } = session;

  c.set('user', user);
  c.set('jwtPayload', payload);
  c.set('householdId', householdId);

  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = payload.exp - now;

  if (timeUntilExpiry < JWT_RENEWAL_THRESHOLD) {
    // Look up session expiry and rotate session ID
    const expiresAt = await getSessionExpiresAt(c.env.DB, payload.sid);
    if (expiresAt) {
      const newSessionId = await rotateSession(c.env.DB, payload.sid, user.id, expiresAt);
      const remainingSeconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));

      // The cookie is reissued through the same path that minted it at login, so the
      // flags cannot drift apart. Carrying `viaRecovery` matters: dropping it would
      // silently promote a recovery session to a full one at the halfway mark.
      await issueSessionCookie(
        c,
        {
          userId: user.id,
          sessionId: newSessionId,
          email: user.email,
          householdId,
          viaRecovery: payload.rec,
        },
        remainingSeconds,
      );

      // Update context so downstream handlers see the new session ID
      c.set('jwtPayload', { ...payload, sid: newSessionId });

      console.info(JSON.stringify({ event: 'session_rotated', requestId, userId: user.id }));
    }
  }

  await next();
});

/** Reject a session that was established through the recovery path.
 *
 *  A recovery login proves control of the mailbox but not knowledge of the password —
 *  there is no verifier to check, because the user is here precisely because they have
 *  forgotten it. Whoever holds such a session can still do nothing useful without the
 *  recovery phrase, since everything they could fetch is ciphertext wrapped under a KEK
 *  derived from it. Confining the session to the key bundle and the reset itself keeps
 *  a mailbox compromise from turning into a download of the household's ciphertext.
 *
 *  Every route except GET /auth/key-bundle and POST /auth/recovery-reset uses this. */
export const requireFullSession = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get('jwtPayload').rec) {
    throw coded('Finish setting a new password first', 403, 'RECOVERY_SESSION');
  }
  await next();
});

/** Scope-carrying routes need a household. A user who signed up against an invite has
 *  none until the inviting member wraps the MasterKey for them. */
export const requireHousehold = createMiddleware<HonoEnv>(async (c, next) => {
  if (!c.get('householdId')) {
    throw coded('No household yet', 409, 'NO_HOUSEHOLD');
  }
  await next();
});
