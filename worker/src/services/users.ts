import { generateId } from '../lib/id.js';
import type { User } from '../types.js';

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

export async function findBySession(
  db: D1Database,
  userId: string,
  sessionId: string,
): Promise<User | null> {
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.created_at, u.updated_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND u.id = ? AND s.expires_at > datetime('now')`,
    )
    .bind(sessionId, userId)
    .first<UserRow>();

  return row ? rowToUser(row) : null;
}

export async function createSession(
  db: D1Database,
  userId: string,
  expiresAt: string,
): Promise<string> {
  const id = generateId();

  await db
    .prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    )
    .bind(id, userId, expiresAt)
    .run();

  return id;
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
