import { Hono } from 'hono';
import { authMiddleware, requireFullSession } from '../middleware/auth.js';
import { rateLimit, userRateLimit } from '../middleware/rate-limit.js';
import { constantTimeEquals } from '../lib/bytes.js';
import {
  COOKIE_NAME,
  clearSessionCookie,
  issueSessionCookie,
  sessionLifetimeSeconds,
} from '../lib/session.js';
import {
  badRequest,
  coded,
  internal,
  notFound,
  unauthorized,
} from '../lib/errors.js';
import {
  assertPubkey,
  assertVerifier,
  assertVerifierMetadata,
  assertKekMetadata,
  assertWrappedMasterKey,
  assertWrappedPrivKey,
  decodeRequired,
  parseKeyPair,
  parsePasswordKey,
} from '../lib/key-material.js';
import { generateId } from '../lib/id.js';
import {
  findByEmail,
  findById,
  create,
  deleteUser,
  createSession,
  deleteSession,
  deleteAllSessionsExcept,
  listSessions,
  deleteSessionForUser,
  cleanupExpiredSessions,
  getPasswordVerifier,
  getVerifierChallenge,
  hasSignedUp,
  insertSessionStatement,
  signupUserStatement,
  updateVerifierStatement,
  upsertUserKeyStatement,
} from '../services/users.js';
import {
  createAuthCode,
  verifyAuthCode,
  cleanupExpiredCodes,
  cleanupExpiredAuthPending,
  consumeAuthPending,
  createAuthPending,
  isUserLockedOut,
} from '../services/auth.js';
import { sendAuthCode } from '../services/email.js';
import * as householdService from '../services/households.js';
import * as inviteService from '../services/invites.js';
import * as keyBundleService from '../services/key-bundle.js';
import { deleteAllForHousehold } from '../services/vault.js';
import { enforceSubjectRateLimit, householdIdOrThrow, parseJsonBody } from './helpers.js';
import type { AppContext, HonoEnv, User } from '../types.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Enough for an email plus a six-digit code. */
const SMALL_BODY_BYTES = 1024;
/** Signup carries four wrapped keys, two salts, a verifier and a pubkey. */
const KEY_BODY_BYTES = 16 * 1024;

/** A recovery-reset session is only trusted for a few minutes after it was issued. */
const RECOVERY_SESSION_MAX_AGE_SECONDS = 5 * 60;

// Rate limiters — IP-based (design section 10)
const loginRateLimit = rateLimit({ max: 5, windowSeconds: 60, keyPrefix: 'auth:login' });
const verifyRateLimit = rateLimit({ max: 30, windowSeconds: 60, keyPrefix: 'auth:verify' });
const signupRateLimit = rateLimit({ max: 5, windowSeconds: 3600, keyPrefix: 'auth:signup' });
const keyBundleRateLimit = rateLimit({ max: 60, windowSeconds: 60, keyPrefix: 'auth:key-bundle' });
const rewrapRateLimit = rateLimit({ max: 5, windowSeconds: 3600, keyPrefix: 'auth:rewrap' });
const sessionRateLimit = rateLimit({ max: 30, windowSeconds: 60, keyPrefix: 'auth:session' });

// Rate limiters — per authenticated user, for the routes that have one before the
// handler runs. The rest are enforced inline, keyed on an email or on the user id the
// bridge token resolves to (see enforceSubjectRateLimit).
const keyBundleUserLimit = userRateLimit({ max: 30, windowSeconds: 60, keyPrefix: 'auth:key-bundle' });
const rewrapUserLimit = userRateLimit({ max: 1, windowSeconds: 3600, keyPrefix: 'auth:rewrap' });

const auth = new Hono<HonoEnv>();

function normaliseEmail(value: unknown): string {
  if (!value || typeof value !== 'string') {
    throw badRequest('Email is required');
  }
  const email = value.toLowerCase().trim();
  if (!EMAIL_REGEX.test(email)) {
    throw badRequest('Invalid email format');
  }
  return email;
}

/** Spend the bridge token from /verify-otp, or reject. Consuming it up front is the
 *  atomic gate for every signup and login-completion path. */
async function spendBridgeToken(c: AppContext, token: unknown): Promise<string> {
  if (!token || typeof token !== 'string') {
    throw coded('Invalid or expired login token', 401, 'AUTH_PENDING_INVALID');
  }
  const userId = await consumeAuthPending(c.env.DB, token);
  if (!userId) {
    throw coded('Invalid or expired login token', 401, 'AUTH_PENDING_INVALID');
  }
  return userId;
}

/** Verifier metadata as it arrives on a signup or password-setting request. */
interface VerifierFields {
  verifier: Uint8Array;
  verifierSalt: Uint8Array;
  verifierKdfKind: number;
  verifierKdfParams: Uint8Array;
}

function parseVerifierFields(body: Record<string, unknown>): VerifierFields {
  const verifier = decodeRequired(body['verifierCandidate']);
  const verifierSalt = decodeRequired(body['verifierSalt']);
  const verifierKdfParams = decodeRequired(body['verifierKdfParams']);
  const verifierKdfKind = body['verifierKdfKind'];

  assertVerifier(verifier);
  assertVerifierMetadata({ verifierSalt, verifierKdfKind, verifierKdfParams });

  return {
    verifier,
    verifierSalt,
    verifierKdfKind: verifierKdfKind as number,
    verifierKdfParams,
  };
}

// POST /auth/login — request an OTP
//
// Still find-or-create. Design section 3.1 says users are only created by /signup, but
// signup needs a bridge token, which needs an OTP, which needs a row: the account has
// to exist before its owner can prove anything about it. A row with pubkey IS NULL is
// inert, which is what makes creating it here harmless.
auth.post('/login', loginRateLimit, async (c) => {
  const body = await parseJsonBody<{ email?: string }>(c, SMALL_BODY_BYTES);
  const email = normaliseEmail(body.email);

  await enforceSubjectRateLimit(c, {
    limiter: 'auth:login:email',
    subject: email,
    max: 3,
    windowSeconds: 900,
  });

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

  const code = await createAuthCode(c.env.DB, user.id);

  try {
    await sendAuthCode(c.env.RESEND_API_KEY, c.env.FROM_EMAIL, email, code);
  } catch (err) {
    console.error(JSON.stringify({
      event: 'email_send_failed', requestId: c.get('requestId'),
      error: err instanceof Error ? err.message : 'Unknown error',
    }));
    throw internal('Unable to send login code. Please try again later.');
  }

  console.info(JSON.stringify({ event: 'login_code_sent', requestId: c.get('requestId') }));

  const requestId = c.get('requestId');
  const logFailure = (task: string) => (err: unknown) => console.error(JSON.stringify({
    event: 'background_task_failed',
    requestId,
    task,
    error: err instanceof Error ? err.message : 'Unknown error',
  }));

  c.executionCtx.waitUntil(
    Promise.all([
      cleanupExpiredCodes(c.env.DB).catch(logFailure('code_cleanup')),
      cleanupExpiredSessions(c.env.DB).catch(logFailure('session_cleanup')),
      cleanupExpiredAuthPending(c.env.DB).catch(logFailure('auth_pending_cleanup')),
      inviteService.expireStale(c.env.DB).catch(logFailure('invite_expiry')),
    ]),
  );

  return c.json({ message: 'Code sent' });
});

// POST /auth/verify-otp — verify the code, hand back a bridge token and the salt
//
// Split out from the old /auth/verify so that the verifier salt is only ever returned
// after the OTP has been passed: returning it on email alone would confirm which
// addresses have accounts.
//
// A user who has requested an OTP but never completed signup gets the bridge token as
// normal, with a null verifierSalt. That is not an error — it is how the client knows
// to route itself to signup rather than to login-completion.
auth.post('/verify-otp', verifyRateLimit, async (c) => {
  const body = await parseJsonBody<{ email?: string; code?: string }>(c, SMALL_BODY_BYTES);
  const email = normaliseEmail(body.email);

  if (!body.code || typeof body.code !== 'string') {
    throw badRequest('Code is required');
  }
  const code = body.code.trim();

  const user = await findByEmail(c.env.DB, email);
  if (!user) {
    throw unauthorized('Invalid email or code');
  }

  await enforceSubjectRateLimit(c, {
    limiter: 'auth:verify:user',
    subject: user.id,
    max: 10,
    windowSeconds: 900,
  });

  const valid = await verifyAuthCode(c.env.DB, user.id, code);
  if (!valid) {
    throw unauthorized('Invalid email or code');
  }

  const authPendingToken = await createAuthPending(c.env.DB, user.id);
  const challenge = await getVerifierChallenge(c.env.DB, user.id);

  console.info(JSON.stringify({ event: 'otp_verified', requestId: c.get('requestId'), userId: user.id }));

  return c.json({ authPendingToken, ...challenge });
});

// POST /auth/login-complete — check the password verifier, issue the session
auth.post('/login-complete', verifyRateLimit, async (c) => {
  const body = await parseJsonBody<Record<string, unknown>>(c, KEY_BODY_BYTES);
  const viaRecovery = body['via'] === 'recovery';

  const userId = await spendBridgeToken(c, body['authPendingToken']);

  await enforceSubjectRateLimit(c, {
    limiter: 'auth:complete:user',
    subject: userId,
    max: 10,
    windowSeconds: 900,
  });

  if (!viaRecovery) {
    const stored = await getPasswordVerifier(c.env.DB, userId);
    const candidate = decodeRequired(body['verifierCandidate']);
    if (!stored || !constantTimeEquals(stored, candidate)) {
      console.warn(JSON.stringify({ event: 'verifier_mismatch', requestId: c.get('requestId'), userId }));
      throw coded('Incorrect password', 401, 'VERIFIER_MISMATCH');
    }
  }

  const user = await requireUser(c, userId);
  const household = await householdService.findForUser(c.env.DB, userId);
  const lifetime = sessionLifetimeSeconds(body['rememberMe'] === true);
  const sessionId = await createSession(
    c.env.DB,
    userId,
    new Date(Date.now() + lifetime * 1000).toISOString(),
  );

  await issueSessionCookie(
    c,
    {
      userId,
      sessionId,
      email: user.email,
      householdId: household?.id ?? null,
      viaRecovery,
    },
    lifetime,
  );

  console.info(JSON.stringify({
    event: 'login_completed', requestId: c.get('requestId'), userId, viaRecovery,
  }));

  return c.json({
    user: { id: user.id, email: user.email },
    household,
    keyBundle: await keyBundleService.build(c.env.DB, userId),
  });
});

/** The bridge token resolved to this id, so the row should exist. It not existing
 *  means the account was deleted between the OTP and this call. */
async function requireUser(c: AppContext, userId: string): Promise<User> {
  const user = await findById(c.env.DB, userId);
  if (!user) {
    throw unauthorized('Invalid or expired login token');
  }
  return user;
}

// POST /auth/signup — create a cloud-sync account and its household
//
// Serves both a net-new account and a local-only user opting into cloud sync: in both
// cases the client has already generated the keypair and MasterKey locally, and this
// call only uploads the wrapped material.
auth.post('/signup', signupRateLimit, async (c) => {
  const body = await parseJsonBody<Record<string, unknown>>(c, KEY_BODY_BYTES);

  // Validate everything before spending the bridge token, so that malformed key
  // material costs the user a retry rather than a fresh OTP.
  const identity = parseVerifierFields(body);
  const pubkey = decodeRequired(body['pubkey']);
  assertPubkey(pubkey);

  const userKeys = parseKeyPair(body['userKeys'], 'wrappedPrivKey');
  const memberKeys = parseKeyPair(body['memberKeys'], 'wrappedMasterKey');
  const household = parseHouseholdInput(body['household']);

  const userId = await spendBridgeToken(c, body['authPendingToken']);

  await enforceSubjectRateLimit(c, {
    limiter: 'auth:signup:user',
    subject: userId,
    max: 5,
    windowSeconds: 3600,
  });

  if (await hasSignedUp(c.env.DB, userId)) {
    throw coded('Account already set up', 409, 'ALREADY_SIGNED_UP');
  }

  const user = await requireUser(c, userId);
  const now = new Date().toISOString();
  const lifetime = sessionLifetimeSeconds(body['rememberMe'] === true);
  const sessionId = generateId();
  const sessionExpiresAt = new Date(Date.now() + lifetime * 1000).toISOString();

  // One batch. Every insert here is guarded by a primary key or unique index, so a
  // replayed signup fails the batch outright rather than half-applying.
  try {
    await c.env.DB.batch([
      signupUserStatement(c.env.DB, userId, { ...identity, pubkey }, now),
      upsertUserKeyStatement(c.env.DB, userId, userKeys.pwd, now),
      upsertUserKeyStatement(c.env.DB, userId, userKeys.recovery, now),
      householdService.createHouseholdStatement(c.env.DB, household, now),
      householdService.addMemberStatement(c.env.DB, household.id, userId, 'owner', now),
      householdService.upsertMemberKeyStatement(c.env.DB, household.id, userId, memberKeys.pwd, now),
      householdService.upsertMemberKeyStatement(c.env.DB, household.id, userId, memberKeys.recovery, now),
      insertSessionStatement(c.env.DB, sessionId, userId, sessionExpiresAt),
    ]);
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      throw coded('Account already set up', 409, 'ALREADY_SIGNED_UP');
    }
    throw err;
  }

  await issueSessionCookie(
    c,
    { userId, sessionId, email: user.email, householdId: household.id },
    lifetime,
  );

  console.info(JSON.stringify({
    event: 'signup_completed', requestId: c.get('requestId'), userId, householdId: household.id,
  }));

  // Sweep for invites addressed to this email (crypto-design section 7.4 path 2). The
  // client shows these as a banner. Note the invite cannot actually be accepted while
  // Q5 stands, since this user now has a household of their own — see the Phase 2
  // design notes for the carried issue.
  const pendingInvites = await inviteService.findOpenForEmail(c.env.DB, user.email);

  return c.json({
    user: { id: user.id, email: user.email },
    household,
    keyBundle: await keyBundleService.build(c.env.DB, userId),
    pendingInvites: pendingInvites.map((invite) => ({
      id: invite.id,
      status: invite.status,
      expiresAt: invite.expiresAt,
    })),
  });
});

function parseHouseholdInput(value: unknown): { id: string; name: string } {
  if (typeof value !== 'object' || value === null) {
    throw badRequest('Household is required');
  }
  const raw = value as { id?: unknown; name?: unknown };
  if (typeof raw.id !== 'string' || raw.id.length === 0 || raw.id.length > 64) {
    throw badRequest('Household id is required');
  }
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name.length > 100) {
    throw badRequest('Household name is too long');
  }
  return { id: raw.id, name: name || 'Household' };
}

// POST /auth/signup-with-invite — create an account that joins someone else's household
//
// No household block and no member keys: the invitee has no MasterKey yet. It arrives
// later, wrapped for their public key, once the inviting member next logs in.
auth.post('/signup-with-invite', signupRateLimit, async (c) => {
  const body = await parseJsonBody<Record<string, unknown>>(c, KEY_BODY_BYTES);

  const identity = parseVerifierFields(body);
  const pubkey = decodeRequired(body['pubkey']);
  assertPubkey(pubkey);
  const userKeys = parseKeyPair(body['userKeys'], 'wrappedPrivKey');

  const inviteToken = body['inviteToken'];
  if (typeof inviteToken !== 'string' || inviteToken.length === 0) {
    throw badRequest('Invite token is required');
  }

  const userId = await spendBridgeToken(c, body['authPendingToken']);

  await enforceSubjectRateLimit(c, {
    limiter: 'auth:signup:user',
    subject: userId,
    max: 5,
    windowSeconds: 3600,
  });

  if (await hasSignedUp(c.env.DB, userId)) {
    throw coded('Account already set up', 409, 'ALREADY_SIGNED_UP');
  }

  const user = await requireUser(c, userId);
  const invite = await inviteService.findByToken(c.env.DB, inviteToken);
  inviteService.assertAcceptable(invite, user.email);

  const now = new Date().toISOString();
  const lifetime = sessionLifetimeSeconds(body['rememberMe'] === true);
  const sessionId = generateId();
  const sessionExpiresAt = new Date(Date.now() + lifetime * 1000).toISOString();

  // The account is created first and the invite claimed second. The reverse order
  // would let a failure here strand a claimed invite against an account with no keys,
  // which nothing could then repair; this way a failed claim leaves a usable account
  // that can accept the invite again through POST /invites/:token/accept.
  try {
    await c.env.DB.batch([
      signupUserStatement(c.env.DB, userId, { ...identity, pubkey }, now),
      upsertUserKeyStatement(c.env.DB, userId, userKeys.pwd, now),
      upsertUserKeyStatement(c.env.DB, userId, userKeys.recovery, now),
      insertSessionStatement(c.env.DB, sessionId, userId, sessionExpiresAt),
    ]);
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      throw coded('Account already set up', 409, 'ALREADY_SIGNED_UP');
    }
    throw err;
  }

  await issueSessionCookie(
    c,
    { userId, sessionId, email: user.email, householdId: null },
    lifetime,
  );

  const claimed = await inviteService.claim(c.env.DB, inviteToken, userId, user.email);

  console.info(JSON.stringify({
    event: 'signup_with_invite_completed', requestId: c.get('requestId'), userId,
  }));

  return c.json({
    user: { id: user.id, email: user.email },
    household: null,
    invite: await inviteService.describeForRecipient(c.env.DB, claimed.id),
    keyBundle: await keyBundleService.build(c.env.DB, userId),
  });
});

// GET /auth/key-bundle — the wrapped material for a local unlock
//
// Reachable on a recovery session, which is the point: it is how the client gets the
// recovery-wrapped rows it needs to unwrap with the phrase.
auth.get('/key-bundle', authMiddleware, keyBundleRateLimit, keyBundleUserLimit, async (c) => {
  const user = c.get('user');

  return c.json(await keyBundleService.build(c.env.DB, user.id));
});

// POST /auth/rewrap-keys — Argon2id rolling upgrade
//
// The client unlocked with the stored parameters, re-derived KEK_pwd at the current
// target parameters, and is now replacing both password-wrapped rows plus the verifier
// in one batch. Only the pwd rows move: recovery is BIP-39, whose parameters never
// change. Partial rewraps are rejected — half an upgrade is worse than none.
auth.post(
  '/rewrap-keys',
  authMiddleware,
  requireFullSession,
  rewrapRateLimit,
  rewrapUserLimit,
  async (c) => {
    const user = c.get('user');
    const householdId = householdIdOrThrow(c);

    const body = await parseJsonBody<Record<string, unknown>>(c, KEY_BODY_BYTES);

    const identity = parseVerifierFields(body);
    const kekSalt = decodeRequired(body['newKekSalt']);
    const kekKdfParams = decodeRequired(body['newKekKdfParams']);
    const kekKdfKind = typeof body['newKekKdfKind'] === 'number' ? body['newKekKdfKind'] : null;

    const metadata = { kekKind: 'pwd' as const, kekSalt, kekKdfKind, kekKdfParams };
    assertKekMetadata(metadata);

    const wrappedPrivKey = decodeRequired(readNested(body, 'newUserKeysPwd', 'wrappedPrivKey'));
    assertWrappedPrivKey(wrappedPrivKey);
    const wrappedMasterKey = decodeRequired(readNested(body, 'newMemberKeysPwd', 'wrappedMasterKey'));
    assertWrappedMasterKey(wrappedMasterKey);

    const now = new Date().toISOString();

    // In-place upserts inside one batch, never delete-then-insert: the old wrap stays
    // valid right up until the new one is durable (Phase 1 section 3.4).
    await c.env.DB.batch([
      upsertUserKeyStatement(c.env.DB, user.id, { ...metadata, wrapped: wrappedPrivKey }, now),
      householdService.upsertMemberKeyStatement(
        c.env.DB,
        householdId,
        user.id,
        { ...metadata, wrapped: wrappedMasterKey },
        now,
      ),
      updateVerifierStatement(
        c.env.DB,
        user.id,
        identity.verifier,
        identity.verifierSalt,
        identity.verifierKdfKind,
        identity.verifierKdfParams,
        now,
      ),
    ]);

    console.info(JSON.stringify({ event: 'keys_rewrapped', requestId: c.get('requestId'), userId: user.id }));

    return c.json({ ok: true });
  },
);

function readNested(body: Record<string, unknown>, outer: string, inner: string): unknown {
  const nested = body[outer];
  if (typeof nested !== 'object' || nested === null) {
    throw badRequest(`${outer} is required`);
  }
  return (nested as Record<string, unknown>)[inner];
}

// POST /auth/recovery-reset — swap in a new password after unlocking with the phrase
//
// The recovery-kind rows are never touched here: the phrase keeps working, and the
// swap is an in-place upsert so a dropped connection leaves the previous password rows
// intact rather than leaving the account with no password path at all.
auth.post('/recovery-reset', authMiddleware, rewrapRateLimit, async (c) => {
  const user = c.get('user');
  const payload = c.get('jwtPayload');

  if (!payload.rec) {
    throw coded('Recovery session required', 403, 'RECOVERY_SESSION_REQUIRED');
  }
  if (Math.floor(Date.now() / 1000) - payload.iat > RECOVERY_SESSION_MAX_AGE_SECONDS) {
    throw coded('Recovery session has expired', 401, 'RECOVERY_SESSION_EXPIRED');
  }

  // Enforced inline rather than as middleware so that the session-kind checks above
  // run first. At one attempt per hour, letting a mistaken call on an ordinary session
  // spend the budget would lock the user out of the reset they actually need.
  await enforceSubjectRateLimit(c, {
    limiter: 'auth:recovery:user',
    subject: user.id,
    max: 1,
    windowSeconds: 3600,
  });

  const householdId = householdIdOrThrow(c);

  const body = await parseJsonBody<Record<string, unknown>>(c, KEY_BODY_BYTES);

  const verifierBlock = body['newVerifier'];
  if (typeof verifierBlock !== 'object' || verifierBlock === null) {
    throw badRequest('newVerifier is required');
  }
  const identity = parseVerifierFields(verifierBlock as Record<string, unknown>);

  const userKeyPwd = parsePasswordKey(body['newUserKeyPwd'], 'wrappedPrivKey');
  const memberKeyPwd = parsePasswordKey(body['newMemberKeyPwd'], 'wrappedMasterKey');

  const now = new Date().toISOString();

  await c.env.DB.batch([
    updateVerifierStatement(
      c.env.DB,
      user.id,
      identity.verifier,
      identity.verifierSalt,
      identity.verifierKdfKind,
      identity.verifierKdfParams,
      now,
    ),
    upsertUserKeyStatement(c.env.DB, user.id, userKeyPwd, now),
    householdService.upsertMemberKeyStatement(c.env.DB, householdId, user.id, memberKeyPwd, now),
  ]);

  console.info(JSON.stringify({ event: 'recovery_reset', requestId: c.get('requestId'), userId: user.id }));

  return c.json({ ok: true });
});

// POST /auth/logout — clear the server session only
//
// Deliberately does not touch the client's in-memory MasterKey, and clearing the
// MasterKey does not touch this (Q6: the two lifetimes are independent).
auth.post('/logout', authMiddleware, sessionRateLimit, async (c) => {
  const payload = c.get('jwtPayload');
  await deleteSession(c.env.DB, payload.sid);
  clearSessionCookie(c);

  console.info(JSON.stringify({ event: 'logout', requestId: c.get('requestId'), userId: payload.sub }));

  return c.json({ message: 'Logged out' });
});

// GET /auth/me
auth.get('/me', authMiddleware, sessionRateLimit, async (c) => {
  const user = c.get('user');
  const householdId = c.get('householdId');
  const household = householdId ? await householdService.findById(c.env.DB, householdId) : null;

  return c.json({ user: { id: user.id, email: user.email }, household });
});

// DELETE /auth/account
//
// households has no foreign key to users, so nothing here cascades on its own. The
// household and its vault are only torn down when the departing user is its last
// member; otherwise their partner keeps both, and only this user's membership and
// wrapped keys go.
auth.delete('/account', authMiddleware, requireFullSession, sessionRateLimit, async (c) => {
  const user = c.get('user');
  const householdId = c.get('householdId');

  if (householdId) {
    const memberCount = await householdService.countMembers(c.env.DB, householdId);
    if (memberCount <= 1) {
      await deleteAllForHousehold(c.env.DB, c.env.VAULT_BUCKET, householdId);
      await c.env.DB.prepare('DELETE FROM households WHERE id = ?').bind(householdId).run();
    }
  }

  // Cascades auth_codes, auth_pending, sessions, user_keys, household_members,
  // household_member_keys and sent invites.
  await deleteUser(c.env.DB, user.id);

  clearSessionCookie(c);

  console.info(JSON.stringify({ event: 'account_deleted', requestId: c.get('requestId'), userId: user.id }));

  return c.json({ message: 'Account deleted' });
});

// POST /auth/revoke-all-sessions
auth.post('/revoke-all-sessions', authMiddleware, requireFullSession, sessionRateLimit, async (c) => {
  const payload = c.get('jwtPayload');
  const revoked = await deleteAllSessionsExcept(c.env.DB, payload.sub, payload.sid);

  console.info(JSON.stringify({ event: 'sessions_revoked', requestId: c.get('requestId'), userId: payload.sub, count: revoked }));

  return c.json({ revoked });
});

// GET /auth/sessions
auth.get('/sessions', authMiddleware, requireFullSession, sessionRateLimit, async (c) => {
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

// DELETE /auth/sessions/:id
auth.delete('/sessions/:id', authMiddleware, requireFullSession, sessionRateLimit, async (c) => {
  const payload = c.get('jwtPayload');
  const sessionId = c.req.param('id');

  if (sessionId === payload.sid) {
    throw badRequest('Cannot revoke current session. Use logout instead.');
  }

  const deleted = await deleteSessionForUser(c.env.DB, sessionId, payload.sub);
  if (!deleted) {
    throw notFound('Session not found');
  }

  console.info(JSON.stringify({ event: 'session_revoked', requestId: c.get('requestId'), userId: payload.sub, sessionId }));

  return c.json({ message: 'Session revoked' });
});

export { COOKIE_NAME };
export default auth;
