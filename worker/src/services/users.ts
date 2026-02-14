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
