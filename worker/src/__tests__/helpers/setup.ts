import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { jwtSign } from '../../lib/crypto.js';
import { generateId } from '../../lib/id.js';
import app from '../../index.js';
import migration0001 from '../../../migrations/0001_initial.sql?raw';
import migration0002 from '../../../migrations/0002_security.sql?raw';
import migration0003 from '../../../migrations/0003_cleanup_indexes.sql?raw';
import migration0004 from '../../../migrations/0004_idempotency.sql?raw';

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
  await execStatements(db, migration0002);
  await execStatements(db, migration0003);
  await execStatements(db, migration0004);
}

export const COOKIE_NAME = '__budget_session';
export const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
const SESSION_EXPIRY_SECONDS = 30 * 24 * 60 * 60;

export async function createAuthenticatedUser(
  db: D1Database,
  options?: { jwtExpiry?: number },
): Promise<{
  user: { id: string; email: string };
  sessionId: string;
  cookie: string;
}> {
  const userId = generateId();
  const email = `test-${userId.slice(0, 8)}@example.com`;
  const now = new Date().toISOString();

  await db
    .prepare('INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .bind(userId, email, now, now)
    .run();

  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_SECONDS * 1000).toISOString();
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, userId, expiresAt)
    .run();

  const token = await jwtSign(
    { sub: userId, sid: sessionId, email },
    env.JWT_SECRET,
    options?.jwtExpiry ?? JWT_EXPIRY_SECONDS,
  );

  return {
    user: { id: userId, email },
    sessionId,
    cookie: `${COOKIE_NAME}=${token}`,
  };
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
