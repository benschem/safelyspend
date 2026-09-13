import { generateId } from '../lib/id.js';
import { sha256, generateAuthCode } from '../lib/crypto.js';
import { randomToken } from '../lib/bytes.js';
import { tooManyRequests } from '../lib/errors.js';

const AUTH_CODE_EXPIRY_MINUTES = 10;
const AUTH_PENDING_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const MAX_DAILY_FAILED_ATTEMPTS = 15;

export async function createAuthCode(
  db: D1Database,
  userId: string,
): Promise<string> {
  const code = generateAuthCode();
  const codeHash = await sha256(code);
  const id = generateId();

  const expiresAt = new Date(
    Date.now() + AUTH_CODE_EXPIRY_MINUTES * 60 * 1000,
  ).toISOString();

  await db
    .prepare(
      'INSERT INTO auth_codes (id, user_id, code_hash, expires_at, attempt_count, created_at) VALUES (?, ?, ?, ?, 0, datetime(\'now\'))',
    )
    .bind(id, userId, codeHash, expiresAt)
    .run();

  return code;
}

export async function verifyAuthCode(
  db: D1Database,
  userId: string,
  code: string,
): Promise<boolean> {
  const now = new Date().toISOString();

  // Brute-force protection: check if any active code has too many attempts
  const maxAttempts = await db
    .prepare(
      'SELECT MAX(attempt_count) as max_attempts FROM auth_codes WHERE user_id = ? AND expires_at > ? AND used_at IS NULL',
    )
    .bind(userId, now)
    .first<{ max_attempts: number | null }>();

  if (maxAttempts && maxAttempts.max_attempts !== null && maxAttempts.max_attempts >= MAX_ATTEMPTS) {
    throw tooManyRequests('Too many verification attempts. Please request a new code.');
  }

  const codeHash = await sha256(code);

  // Find matching unexpired, unused code
  const row = await db
    .prepare(
      'SELECT id FROM auth_codes WHERE user_id = ? AND code_hash = ? AND expires_at > ? AND used_at IS NULL LIMIT 1',
    )
    .bind(userId, codeHash, now)
    .first<{ id: string }>();

  if (!row) {
    // Increment attempt_count on all active codes for this user
    await db
      .prepare(
        'UPDATE auth_codes SET attempt_count = attempt_count + 1 WHERE user_id = ? AND expires_at > ? AND used_at IS NULL',
      )
      .bind(userId, now)
      .run();

    return false;
  }

  // Mark matched code as used and invalidate all other active codes
  await db.batch([
    db
      .prepare('UPDATE auth_codes SET used_at = ? WHERE id = ?')
      .bind(now, row.id),
    db
      .prepare(
        'UPDATE auth_codes SET used_at = ? WHERE user_id = ? AND id != ? AND expires_at > ? AND used_at IS NULL',
      )
      .bind(now, userId, row.id, now),
  ]);

  return true;
}

export async function isUserLockedOut(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(attempt_count), 0) as total
       FROM auth_codes
       WHERE user_id = ? AND created_at > datetime('now', '-1 day') AND used_at IS NULL`,
    )
    .bind(userId)
    .first<{ total: number }>();
  return (row?.total ?? 0) >= MAX_DAILY_FAILED_ATTEMPTS;
}

export async function cleanupExpiredCodes(db: D1Database): Promise<void> {
  // Use SQLite's datetime() for consistent format comparison with created_at
  // (created_at uses datetime('now') which returns 'YYYY-MM-DD HH:MM:SS')
  await db
    .prepare("DELETE FROM auth_codes WHERE created_at < datetime('now', '-1 hour')")
    .run();
}

// --- Bridge tokens (auth_pending) ---

/** Issued once the OTP has been verified, and spent by /login-complete or /signup.
 *  A dedicated single-use bearer credential rather than a JWT with a purpose claim:
 *  a purpose claim is only as good as every handler remembering to check it. */
export async function createAuthPending(db: D1Database, userId: string): Promise<string> {
  const token = randomToken();
  const expiresAt = new Date(
    Date.now() + AUTH_PENDING_EXPIRY_MINUTES * 60 * 1000,
  ).toISOString();

  await db
    .prepare('INSERT INTO auth_pending (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, userId, expiresAt)
    .run();

  return token;
}

/** Spend the bridge token, returning the user it was issued to, or null if it is
 *  unknown, expired, or already used.
 *
 *  The single guarded UPDATE is the atomic gate for everything that follows. It runs
 *  before the caller's batch rather than inside it because D1 rolls a batch back only
 *  on a statement *error* — a guarded UPDATE that matches no rows is a success with
 *  zero changes, so putting it in the batch would let the rest of the batch apply
 *  against a token that was already spent. The cost is that a failure after this
 *  point burns the token and the user redoes the OTP.
 */
export async function consumeAuthPending(
  db: D1Database,
  token: string,
): Promise<string | null> {
  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `UPDATE auth_pending SET used_at = ?
       WHERE id = ? AND used_at IS NULL AND expires_at > ?
       RETURNING user_id`,
    )
    .bind(now, token, now)
    .first<{ user_id: string }>();

  return row?.user_id ?? null;
}

export async function cleanupExpiredAuthPending(db: D1Database): Promise<void> {
  await db
    .prepare("DELETE FROM auth_pending WHERE expires_at < datetime('now', '-1 hour')")
    .run();
}
