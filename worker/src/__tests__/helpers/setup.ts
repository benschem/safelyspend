import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { jwtSign } from '../../lib/crypto.js';
import { generateId } from '../../lib/id.js';
import { COOKIE_NAME, JWT_EXPIRY_SECONDS } from '../../lib/session.js';
import app from '../../index.js';
import migration0001 from '../../../migrations/0001_initial.sql?raw';

/** Split multi-statement SQL and execute each statement individually.
 *  D1's exec() has observability bugs in the test runtime, so we use prepare().run(). */
async function execStatements(db: D1Database, sql: string): Promise<void> {
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await db.prepare(stmt).run();
  }
}

export async function applyMigrations(db: D1Database): Promise<void> {
  await execStatements(db, migration0001);
}

// Re-exported so the tests assert against the values the app actually ships, rather
// than against a second copy that could drift away from them unnoticed.
export { COOKIE_NAME, JWT_EXPIRY_SECONDS };

const SESSION_EXPIRY_SECONDS = 30 * 24 * 60 * 60;

export interface TestUser {
  user: { id: string; email: string };
  householdId: string | null;
  sessionId: string;
  cookie: string;
}

export interface CreateUserOptions {
  jwtExpiry?: number;
  /** Skip household creation, mirroring an invitee whose handoff has not completed. */
  withoutHousehold?: boolean;
  /** Mark the session as recovery-only, as /login-complete does for `via=recovery`. */
  viaRecovery?: boolean;
  /** Join this existing household rather than creating a new one. */
  joinHouseholdId?: string;
  email?: string;
}

/** Seed a signed-up user with a live session, straight into the database. Bypasses the
 *  OTP and verifier flow, which is what the auth route tests exercise directly. */
export async function createAuthenticatedUser(
  db: D1Database,
  options: CreateUserOptions = {},
): Promise<TestUser> {
  const userId = generateId();
  const email = options.email ?? `test-${userId.slice(0, 8)}@example.com`;
  const now = new Date().toISOString();

  await db
    .prepare(
      'INSERT INTO users (id, email, pubkey, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(userId, email, new Uint8Array(32).fill(7), now, now)
    .run();

  let householdId: string | null = null;
  if (!options.withoutHousehold) {
    householdId = options.joinHouseholdId ?? generateId();
    if (!options.joinHouseholdId) {
      await db
        .prepare('INSERT INTO households (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .bind(householdId, 'Test Household', now, now)
        .run();
    }
    await db
      .prepare(
        'INSERT INTO household_members (id, household_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(generateId(), householdId, userId, options.joinHouseholdId ? 'member' : 'owner', now)
      .run();
  }

  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_SECONDS * 1000).toISOString();
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, userId, expiresAt)
    .run();

  const token = await jwtSign(
    {
      sub: userId,
      sid: sessionId,
      email,
      ...(householdId ? { hid: householdId } : {}),
      ...(options.viaRecovery ? { rec: true } : {}),
    },
    env.JWT_SECRET,
    options.jwtExpiry ?? JWT_EXPIRY_SECONDS,
  );

  return {
    user: { id: userId, email },
    householdId,
    sessionId,
    cookie: `${COOKIE_NAME}=${token}`,
  };
}

/** Drive the real OTP flow up to the bridge token, the way a client would. */
export async function requestBridgeToken(
  email: string,
  capturedCode: () => string,
): Promise<{ authPendingToken: string; verifierSalt: string | null }> {
  await appFetch(jsonRequest('/v1/auth/login', { email }));
  const res = await appFetch(jsonRequest('/v1/auth/verify-otp', { email, code: capturedCode() }));

  if (res.status !== 200) {
    throw new Error(`verify-otp failed with ${res.status}`);
  }
  return (await res.json()) as { authPendingToken: string; verifierSalt: string | null };
}

/** Build an authenticated request with no body. */
export function authedRequest(
  path: string,
  cookie: string,
  method = 'GET',
): Request {
  return new Request(`http://localhost${path}`, { method, headers: { Cookie: cookie } });
}

/** Build a JSON POST request. */
export function jsonRequest(
  path: string,
  body: Record<string, unknown>,
  options: { cookie?: string; method?: string } = {},
): Request {
  return new Request(`http://localhost${path}`, {
    method: options.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** Send a request through the full Hono middleware + route stack. */
export async function appFetch(request: Request): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await app.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}
