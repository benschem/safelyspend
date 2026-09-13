import { generateId } from '../lib/id.js';
import { blobToBase64url, blobToBase64urlOrThrow } from '../lib/bytes.js';
import type { KekKind, WrappedKeyInput } from '../lib/key-material.js';
import type { Household } from '../types.js';

/** v1 caps a household at two people (Q5: one household per user, one invite each). */
export const MAX_HOUSEHOLD_MEMBERS = 2;

export async function findById(db: D1Database, householdId: string): Promise<Household | null> {
  const row = await db
    .prepare('SELECT id, name FROM households WHERE id = ?')
    .bind(householdId)
    .first<{ id: string; name: string }>();

  return row ? { id: row.id, name: row.name } : null;
}

export async function findForUser(db: D1Database, userId: string): Promise<Household | null> {
  const row = await db
    .prepare(
      `SELECT h.id, h.name
       FROM household_members hm JOIN households h ON h.id = hm.household_id
       WHERE hm.user_id = ?`,
    )
    .bind(userId)
    .first<{ id: string; name: string }>();

  return row ? { id: row.id, name: row.name } : null;
}

export async function countMembers(db: D1Database, householdId: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS count FROM household_members WHERE household_id = ?')
    .bind(householdId)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

export async function isMember(
  db: D1Database,
  householdId: string,
  userId: string,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT id FROM household_members WHERE household_id = ? AND user_id = ?')
    .bind(householdId, userId)
    .first<{ id: string }>();

  return row !== null;
}

export function createHouseholdStatement(
  db: D1Database,
  household: Household,
  now: string,
): D1PreparedStatement {
  return db
    .prepare('INSERT INTO households (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .bind(household.id, household.name, now, now);
}

export function addMemberStatement(
  db: D1Database,
  householdId: string,
  userId: string,
  role: 'owner' | 'member',
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      'INSERT INTO household_members (id, household_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(generateId(), householdId, userId, role, now);
}

/** Upsert rather than insert: the pwd and recovery rows are rewritten in place by the
 *  Argon2id rolling upgrade, the recovery reset, and the invitee's rewrap. Phase 1
 *  section 3.4 requires the old wrap stay valid until the new one is durable, which an
 *  in-place update inside a batch gives and a delete-then-insert would not. */
export function upsertMemberKeyStatement(
  db: D1Database,
  householdId: string,
  userId: string,
  key: WrappedKeyInput,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO household_member_keys
         (household_id, user_id, kek_kind, wrapped_master_key, kek_salt, kek_kdf_kind,
          kek_kdf_params, sender_user_id, sender_pubkey, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
       ON CONFLICT(household_id, user_id, kek_kind) DO UPDATE SET
         wrapped_master_key = excluded.wrapped_master_key,
         kek_salt = excluded.kek_salt,
         kek_kdf_kind = excluded.kek_kdf_kind,
         kek_kdf_params = excluded.kek_kdf_params,
         sender_user_id = NULL,
         sender_pubkey = NULL,
         updated_at = excluded.updated_at`,
    )
    .bind(
      householdId,
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

/** The transient handoff row. Every KDF column is NULL because the key was not
 *  derived by a KDF; the per-handoff entropy is the ephemeral public key inside the
 *  envelope. sender_pubkey mirrors the envelope's SENDER_PUB so the recipient can
 *  compute the safety-number fingerprint without parsing the blob first. */
export function insertEciesMemberKeyStatement(
  db: D1Database,
  householdId: string,
  userId: string,
  wrappedMasterKey: Uint8Array,
  senderUserId: string,
  senderPubkey: Uint8Array,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO household_member_keys
         (household_id, user_id, kek_kind, wrapped_master_key, kek_salt, kek_kdf_kind,
          kek_kdf_params, sender_user_id, sender_pubkey, created_at, updated_at)
       VALUES (?, ?, 'ecies', ?, NULL, NULL, NULL, ?, ?, ?, ?)`,
    )
    .bind(householdId, userId, wrappedMasterKey, senderUserId, senderPubkey, now, now);
}

export function deleteEciesMemberKeyStatement(
  db: D1Database,
  householdId: string,
  userId: string,
): D1PreparedStatement {
  return db
    .prepare(
      "DELETE FROM household_member_keys WHERE household_id = ? AND user_id = ? AND kek_kind = 'ecies'",
    )
    .bind(householdId, userId);
}

export interface MemberKeyRow {
  kekKind: KekKind;
  wrappedMasterKey: string;
  kekSalt: string | null;
  kekKdfKind: number | null;
  kekKdfParams: string | null;
  senderUserId: string | null;
  senderPubkey: string | null;
}

interface MemberKeyDbRow {
  kek_kind: KekKind;
  wrapped_master_key: unknown;
  kek_salt: unknown;
  kek_kdf_kind: number | null;
  kek_kdf_params: unknown;
  sender_user_id: string | null;
  sender_pubkey: unknown;
}

function toMemberKeyRow(row: MemberKeyDbRow): MemberKeyRow {
  return {
    kekKind: row.kek_kind,
    wrappedMasterKey: blobToBase64urlOrThrow(
      row.wrapped_master_key,
      'household_member_keys.wrapped_master_key',
    ),
    kekSalt: blobToBase64url(row.kek_salt),
    kekKdfKind: row.kek_kdf_kind,
    kekKdfParams: blobToBase64url(row.kek_kdf_params),
    senderUserId: row.sender_user_id,
    senderPubkey: blobToBase64url(row.sender_pubkey),
  };
}

const MEMBER_KEY_COLUMNS = `kek_kind, wrapped_master_key, kek_salt, kek_kdf_kind,
                            kek_kdf_params, sender_user_id, sender_pubkey`;

export async function listMemberKeys(
  db: D1Database,
  userId: string,
): Promise<MemberKeyRow[]> {
  const { results } = await db
    .prepare(
      `SELECT ${MEMBER_KEY_COLUMNS} FROM household_member_keys
       WHERE user_id = ? ORDER BY kek_kind`,
    )
    .bind(userId)
    .all<MemberKeyDbRow>();

  return results.map(toMemberKeyRow);
}

export async function hasMemberKey(
  db: D1Database,
  householdId: string,
  userId: string,
  kekKind: KekKind,
): Promise<boolean> {
  const row = await db
    .prepare(
      'SELECT kek_kind FROM household_member_keys WHERE household_id = ? AND user_id = ? AND kek_kind = ?',
    )
    .bind(householdId, userId, kekKind)
    .first<{ kek_kind: string }>();

  return row !== null;
}

export interface IncomingHandoff {
  householdId: string;
  senderUserId: string | null;
  senderEmail: string | null;
  senderPubkey: string | null;
  wrappedMasterKey: string;
  kekKind: 'ecies';
  createdAt: string;
}

/** What the invitee polls for while sitting on the "waiting for partner" screen.
 *  Zero or one row in v1; the array shape future-proofs for multi-household. */
export async function listIncomingHandoffs(
  db: D1Database,
  userId: string,
): Promise<IncomingHandoff[]> {
  const { results } = await db
    .prepare(
      `SELECT k.household_id, k.wrapped_master_key, k.sender_user_id, k.sender_pubkey,
              k.created_at, u.email AS sender_email
       FROM household_member_keys k
       LEFT JOIN users u ON u.id = k.sender_user_id
       WHERE k.user_id = ? AND k.kek_kind = 'ecies'`,
    )
    .bind(userId)
    .all<{
      household_id: string;
      wrapped_master_key: unknown;
      sender_user_id: string | null;
      sender_pubkey: unknown;
      created_at: string;
      sender_email: string | null;
    }>();

  return results.map((row) => ({
    householdId: row.household_id,
    senderUserId: row.sender_user_id,
    senderEmail: row.sender_email,
    senderPubkey: blobToBase64url(row.sender_pubkey),
    wrappedMasterKey: blobToBase64urlOrThrow(
      row.wrapped_master_key,
      'household_member_keys.wrapped_master_key',
    ),
    kekKind: 'ecies' as const,
    createdAt: row.created_at,
  }));
}
