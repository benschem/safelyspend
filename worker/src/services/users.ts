import { generateId } from '../lib/id.js';
import { blobToBytes, blobToBase64url, blobToBase64urlOrThrow } from '../lib/bytes.js';
import type { KekKind, WrappedKeyInput } from '../lib/key-material.js';
import type { User } from '../types.js';

const MAX_SESSIONS_PER_USER = 10;

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findByEmail(
  db: D1Database,
  email: string,
): Promise<User | null> {
  const row = await db
    .prepare('SELECT id, email, created_at, updated_at FROM users WHERE email = ?')
    .bind(email)
    .first<UserRow>();

  return row ? rowToUser(row) : null;
}

export async function findById(
  db: D1Database,
  id: string,
): Promise<User | null> {
  const row = await db
    .prepare('SELECT id, email, created_at, updated_at FROM users WHERE id = ?')
    .bind(id)
    .first<UserRow>();

  return row ? rowToUser(row) : null;
}

export async function create(
  db: D1Database,
  email: string,
): Promise<User> {
  const id = generateId();
  const now = new Date().toISOString();

  await db
    .prepare('INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .bind(id, email, now, now)
    .run();

  return {
    id,
    email,
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteUser(
  db: D1Database,
  id: string,
): Promise<void> {
  await db
    .prepare('DELETE FROM users WHERE id = ?')
    .bind(id)
    .run();
}

/** Resolve the session to its user and current household in one query. The household
 *  comes from household_members rather than the JWT claim so that an invitee who was
 *  added to a household after their token was signed is scoped correctly straight
 *  away, without having to log in again. */
export async function findBySession(
  db: D1Database,
  userId: string,
  sessionId: string,
): Promise<{ user: User; householdId: string | null } | null> {
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.created_at, u.updated_at, hm.household_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN household_members hm ON hm.user_id = u.id
       WHERE s.id = ? AND u.id = ? AND s.expires_at > datetime('now')`,
    )
    .bind(sessionId, userId)
    .first<UserRow & { household_id: string | null }>();

  if (!row) {
    return null;
  }
  return { user: rowToUser(row), householdId: row.household_id };
}

export async function createSession(
  db: D1Database,
  userId: string,
  expiresAt: string,
): Promise<string> {
  const id = generateId();

  // Enforce session cap — delete oldest active sessions if at limit
  const countRow = await db
    .prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND expires_at > datetime('now')")
    .bind(userId)
    .first<{ count: number }>();

  if ((countRow?.count ?? 0) >= MAX_SESSIONS_PER_USER) {
    const toDelete = (countRow?.count ?? 0) - MAX_SESSIONS_PER_USER + 1;
    await db
      .prepare(
        `DELETE FROM sessions WHERE id IN (
          SELECT id FROM sessions WHERE user_id = ? AND expires_at > datetime('now')
          ORDER BY created_at ASC LIMIT ?
        )`,
      )
      .bind(userId, toDelete)
      .run();
  }

  await db
    .prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    )
    .bind(id, userId, expiresAt)
    .run();

  return id;
}

/** Raw session insert for handlers that create the session inside a batch. Skips the
 *  per-user session cap that createSession enforces, which is safe because the only
 *  callers are signup paths where the user has no other sessions. */
export function insertSessionStatement(
  db: D1Database,
  sessionId: string,
  userId: string,
  expiresAt: string,
): D1PreparedStatement {
  return db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, userId, expiresAt);
}

export async function deleteSession(
  db: D1Database,
  sessionId: string,
): Promise<void> {
  await db
    .prepare('DELETE FROM sessions WHERE id = ?')
    .bind(sessionId)
    .run();
}

export async function deleteAllSessionsExcept(
  db: D1Database,
  userId: string,
  currentSessionId: string,
): Promise<number> {
  const result = await db
    .prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?')
    .bind(userId, currentSessionId)
    .run();
  return result.meta.changes ?? 0;
}

export async function getSessionExpiresAt(
  db: D1Database,
  sessionId: string,
): Promise<string | null> {
  const row = await db
    .prepare('SELECT expires_at FROM sessions WHERE id = ?')
    .bind(sessionId)
    .first<{ expires_at: string }>();
  return row?.expires_at ?? null;
}

export async function rotateSession(
  db: D1Database,
  oldSessionId: string,
  userId: string,
  expiresAt: string,
): Promise<string> {
  const newId = generateId();
  // Create first, then delete — if delete fails, user still has a session
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(newId, userId, expiresAt)
    .run();
  await db
    .prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')
    .bind(oldSessionId, userId)
    .run();
  return newId;
}

export interface SessionInfo {
  id: string;
  createdAt: string;
}

export async function listSessions(
  db: D1Database,
  userId: string,
): Promise<SessionInfo[]> {
  const rows = await db
    .prepare(
      "SELECT id, created_at FROM sessions WHERE user_id = ? AND expires_at > datetime('now') ORDER BY created_at DESC",
    )
    .bind(userId)
    .all<{ id: string; created_at: string }>();
  return rows.results.map((r) => ({ id: r.id, createdAt: r.created_at }));
}

export async function deleteSessionForUser(
  db: D1Database,
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function cleanupExpiredSessions(db: D1Database): Promise<void> {
  await db
    .prepare("DELETE FROM sessions WHERE expires_at < datetime('now')")
    .run();
}

// --- Key material ---

/** The Argon2id parameters a client needs before it can derive a verifier candidate.
 *  Returned only after the OTP challenge has been passed, so that requesting it does
 *  not reveal whether an email is registered. */
export interface VerifierChallenge {
  verifierSalt: string | null;
  verifierKdfKind: number | null;
  verifierKdfParams: string | null;
}

export async function getVerifierChallenge(
  db: D1Database,
  userId: string,
): Promise<VerifierChallenge> {
  const row = await db
    .prepare('SELECT verifier_salt, verifier_kdf_kind, verifier_kdf_params FROM users WHERE id = ?')
    .bind(userId)
    .first<{ verifier_salt: unknown; verifier_kdf_kind: number | null; verifier_kdf_params: unknown }>();

  return {
    verifierSalt: blobToBase64url(row?.verifier_salt),
    verifierKdfKind: row?.verifier_kdf_kind ?? null,
    verifierKdfParams: blobToBase64url(row?.verifier_kdf_params),
  };
}

export async function getPasswordVerifier(
  db: D1Database,
  userId: string,
): Promise<Uint8Array | null> {
  const row = await db
    .prepare('SELECT password_verifier FROM users WHERE id = ?')
    .bind(userId)
    .first<{ password_verifier: unknown }>();

  return blobToBytes(row?.password_verifier);
}

export async function getPubkey(db: D1Database, userId: string): Promise<Uint8Array | null> {
  const row = await db
    .prepare('SELECT pubkey FROM users WHERE id = ?')
    .bind(userId)
    .first<{ pubkey: unknown }>();

  return blobToBytes(row?.pubkey);
}

export async function hasSignedUp(db: D1Database, userId: string): Promise<boolean> {
  return (await getPubkey(db, userId)) !== null;
}

export interface SignupIdentity {
  verifier: Uint8Array;
  verifierSalt: Uint8Array;
  verifierKdfKind: number;
  verifierKdfParams: Uint8Array;
  pubkey: Uint8Array;
}

/** `WHERE pubkey IS NULL` is the first-signup-wins guard: a retried signup affects
 *  zero rows, which rolls the whole batch back and surfaces as ALREADY_SIGNED_UP. */
export function signupUserStatement(
  db: D1Database,
  userId: string,
  identity: SignupIdentity,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE users
       SET password_verifier = ?, verifier_salt = ?, verifier_kdf_kind = ?,
           verifier_kdf_params = ?, pubkey = ?, updated_at = ?
       WHERE id = ? AND pubkey IS NULL`,
    )
    .bind(
      identity.verifier,
      identity.verifierSalt,
      identity.verifierKdfKind,
      identity.verifierKdfParams,
      identity.pubkey,
      now,
      userId,
    );
}

export function upsertUserKeyStatement(
  db: D1Database,
  userId: string,
  key: WrappedKeyInput,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO user_keys
         (user_id, kek_kind, wrapped_priv_key, kek_salt, kek_kdf_kind, kek_kdf_params, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, kek_kind) DO UPDATE SET
         wrapped_priv_key = excluded.wrapped_priv_key,
         kek_salt = excluded.kek_salt,
         kek_kdf_kind = excluded.kek_kdf_kind,
         kek_kdf_params = excluded.kek_kdf_params,
         updated_at = excluded.updated_at`,
    )
    .bind(
      userId,
      key.kekKind,
      key.wrapped,
      key.kekSalt,
      key.kekKdfKind,
      key.kekKdfParams,
      now,
      now,
    );
}

export function updateVerifierStatement(
  db: D1Database,
  userId: string,
  verifier: Uint8Array,
  verifierSalt: Uint8Array,
  verifierKdfKind: number,
  verifierKdfParams: Uint8Array,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE users
       SET password_verifier = ?, verifier_salt = ?, verifier_kdf_kind = ?,
           verifier_kdf_params = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(verifier, verifierSalt, verifierKdfKind, verifierKdfParams, now, userId);
}

export interface WrappedKeyRow {
  kekKind: KekKind;
  kekSalt: string | null;
  kekKdfKind: number | null;
  kekKdfParams: string | null;
}

export interface UserKeyRow extends WrappedKeyRow {
  wrappedPrivKey: string;
}

export async function listUserKeys(db: D1Database, userId: string): Promise<UserKeyRow[]> {
  const { results } = await db
    .prepare(
      `SELECT kek_kind, wrapped_priv_key, kek_salt, kek_kdf_kind, kek_kdf_params
       FROM user_keys WHERE user_id = ? ORDER BY kek_kind`,
    )
    .bind(userId)
    .all<{
      kek_kind: KekKind;
      wrapped_priv_key: unknown;
      kek_salt: unknown;
      kek_kdf_kind: number | null;
      kek_kdf_params: unknown;
    }>();

  return results.map((row) => ({
    kekKind: row.kek_kind,
    wrappedPrivKey: blobToBase64urlOrThrow(row.wrapped_priv_key, 'user_keys.wrapped_priv_key'),
    kekSalt: blobToBase64url(row.kek_salt),
    kekKdfKind: row.kek_kdf_kind,
    kekKdfParams: blobToBase64url(row.kek_kdf_params),
  }));
}
