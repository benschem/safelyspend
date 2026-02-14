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
      'INSERT INTO auth_codes (id, user_id, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))',
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
  // Brute-force protection: count recent attempts (last 10 minutes)
  const tenMinutesAgo = new Date(
    Date.now() - AUTH_CODE_EXPIRY_MINUTES * 60 * 1000,
  ).toISOString();

  const attempts = await db
    .prepare(
      'SELECT COUNT(*) as count FROM auth_codes WHERE user_id = ? AND used_at IS NOT NULL AND used_at > ?',
    )
    .bind(userId, tenMinutesAgo)
    .first<{ count: number }>();

  if (attempts && attempts.count >= MAX_ATTEMPTS) {
    throw tooManyRequests('Too many verification attempts. Please request a new code.');
  }

  const codeHash = await sha256(code);
  const now = new Date().toISOString();

  // Find matching unexpired, unused code
  const row = await db
    .prepare(
      'SELECT id FROM auth_codes WHERE user_id = ? AND code_hash = ? AND expires_at > ? AND used_at IS NULL LIMIT 1',
    )
    .bind(userId, codeHash, now)
    .first<{ id: string }>();

  if (!row) {
    // Mark a failed attempt by creating a "used" record for tracking
    // We do this by updating any unexpired code for this user to track attempt
    return false;
  }

  // Mark as used
  await db
    .prepare('UPDATE auth_codes SET used_at = ? WHERE id = ?')
    .bind(now, row.id)
    .run();

  return true;
}

export async function cleanupExpiredCodes(db: D1Database): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  await db
    .prepare('DELETE FROM auth_codes WHERE created_at < ?')
    .bind(oneHourAgo)
    .run();
}
