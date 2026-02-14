import { generateId } from '../lib/id.js';
import { sha256, generateAuthCode } from '../lib/crypto.js';
import { tooManyRequests } from '../lib/errors.js';

const AUTH_CODE_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

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

export async function cleanupExpiredCodes(db: D1Database): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  await db
    .prepare('DELETE FROM auth_codes WHERE created_at < ?')
    .bind(oneHourAgo)
    .run();
}
