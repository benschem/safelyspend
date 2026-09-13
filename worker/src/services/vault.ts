/** Vault storage. Scoped to the household, not the user: both partners read and write
 *  the same encrypted blob, and the R2 key is <household_id>/<vault_id>.
 *
 *  The optimistic-concurrency machinery is unchanged from the single-user version, but
 *  its meaning is not: a rejected push used to mean your own stale tab, and now
 *  routinely means your partner got there first. What the losing client does about
 *  that is Phase 8's call.
 */

import { generateId } from '../lib/id.js';
import { sha256ArrayBuffer } from '../lib/crypto.js';
import { conflict } from '../lib/errors.js';

interface VaultMetadataRow {
  current_version: number;
  size_bytes: number;
  checksum: string;
  updated_at: string;
}

interface VaultRow {
  id: string;
  version: number;
  size_bytes: number;
  checksum: string;
  created_at: string;
}

interface SyncStateRow {
  current_version: number;
  current_vault_id: string | null;
}

export interface VaultMetadata {
  version: number;
  sizeBytes: number;
  checksum: string;
  updatedAt: string;
}

export interface VaultData {
  body: ReadableStream;
  version: number;
  sizeBytes: number;
  checksum: string;
}

export interface VaultHistoryEntry {
  id: string;
  version: number;
  sizeBytes: number;
  checksum: string;
  createdAt: string;
}

export async function getMetadata(
  db: D1Database,
  householdId: string,
): Promise<VaultMetadata | null> {
  const row = await db
    .prepare(
      `SELECT s.current_version, v.size_bytes, v.checksum, s.updated_at
       FROM sync_state s
       LEFT JOIN vaults v ON v.id = s.current_vault_id
       WHERE s.household_id = ?`,
    )
    .bind(householdId)
    .first<VaultMetadataRow>();

  if (!row || row.current_version === 0) {
    return null;
  }

  return {
    version: row.current_version,
    sizeBytes: row.size_bytes,
    checksum: row.checksum,
    updatedAt: row.updated_at,
  };
}

export async function getData(
  db: D1Database,
  bucket: R2Bucket,
  householdId: string,
): Promise<VaultData | null> {
  const vault = await db
    .prepare(
      `SELECT v.r2_key, v.version, v.size_bytes, v.checksum
       FROM sync_state s
       JOIN vaults v ON v.id = s.current_vault_id
       WHERE s.household_id = ?`,
    )
    .bind(householdId)
    .first<{ r2_key: string; version: number; size_bytes: number; checksum: string }>();

  if (!vault) {
    return null;
  }

  const object = await bucket.get(vault.r2_key);
  if (!object) {
    return null;
  }

  return {
    body: object.body,
    version: vault.version,
    sizeBytes: vault.size_bytes,
    checksum: vault.checksum,
  };
}

export async function getDataByVaultId(
  db: D1Database,
  bucket: R2Bucket,
  householdId: string,
  vaultId: string,
): Promise<{ body: ReadableStream; version: number } | null> {
  const vault = await db
    .prepare('SELECT r2_key, version FROM vaults WHERE id = ? AND household_id = ?')
    .bind(vaultId, householdId)
    .first<{ r2_key: string; version: number }>();

  if (!vault) {
    return null;
  }

  const object = await bucket.get(vault.r2_key);
  if (!object) {
    return null;
  }

  return {
    body: object.body,
    version: vault.version,
  };
}

export async function putData(
  db: D1Database,
  bucket: R2Bucket,
  householdId: string,
  data: ArrayBuffer,
  expectedVersion: number,
  idempotencyKey?: string,
): Promise<{ version: number; vaultId: string }> {
  // If idempotency key provided, check for a previous upload with the same key
  if (idempotencyKey) {
    const existing = await db
      .prepare('SELECT id, version FROM vaults WHERE household_id = ? AND idempotency_key = ?')
      .bind(householdId, idempotencyKey)
      .first<{ id: string; version: number }>();

    if (existing) {
      return { version: existing.version, vaultId: existing.id };
    }
  }

  // Pre-check current version (fast reject for stale clients before R2 upload)
  const syncState = await db
    .prepare('SELECT current_version, current_vault_id FROM sync_state WHERE household_id = ?')
    .bind(householdId)
    .first<SyncStateRow>();

  const currentVersion = syncState?.current_version ?? 0;

  if (currentVersion !== expectedVersion) {
    throw conflict('Version conflict', { currentVersion });
  }

  const newVersion = currentVersion + 1;
  const vaultId = generateId();
  const r2Key = `${householdId}/${vaultId}`;
  const checksum = await sha256ArrayBuffer(data);
  const sizeBytes = data.byteLength;
  const now = new Date().toISOString();

  // Upload to R2 (idempotent; orphan cleaned up on conflict)
  await bucket.put(r2Key, data);

  // Atomic D1 batch: INSERT vault + UPDATE sync_state with optimistic lock
  try {
    const batchResults = await db.batch([
      db
        .prepare(
          'INSERT INTO vaults (id, household_id, version, r2_key, size_bytes, checksum, created_at, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(vaultId, householdId, newVersion, r2Key, sizeBytes, checksum, now, idempotencyKey ?? null),
      syncState
        ? db
            .prepare(
              'UPDATE sync_state SET current_version = ?, current_vault_id = ?, updated_at = ? WHERE household_id = ? AND current_version = ?',
            )
            .bind(newVersion, vaultId, now, householdId, expectedVersion)
        : db
            .prepare(
              'INSERT INTO sync_state (household_id, current_version, current_vault_id, updated_at) VALUES (?, ?, ?, ?)',
            )
            .bind(householdId, newVersion, vaultId, now),
    ]);

    // Check if UPDATE affected 0 rows (another request snuck in)
    if (syncState && batchResults[1]?.meta.changes === 0) {
      // Clean up orphan vault record + R2
      await Promise.all([
        db.prepare('DELETE FROM vaults WHERE id = ?').bind(vaultId).run(),
        bucket.delete(r2Key),
      ]);
      const latest = await db
        .prepare('SELECT current_version FROM sync_state WHERE household_id = ?')
        .bind(householdId)
        .first<{ current_version: number }>();
      throw conflict('Version conflict', { currentVersion: latest?.current_version ?? currentVersion });
    }
  } catch (err) {
    // Unique constraint violation on vaults(household_id, version) means concurrent write
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      await bucket.delete(r2Key);
      const latest = await db
        .prepare('SELECT current_version FROM sync_state WHERE household_id = ?')
        .bind(householdId)
        .first<{ current_version: number }>();
      throw conflict('Version conflict', { currentVersion: latest?.current_version ?? currentVersion });
    }
    // Clean up orphaned R2 object before re-throwing
    await bucket.delete(r2Key).catch((deleteErr) =>
      console.error(JSON.stringify({
        event: 'r2_cleanup_failed',
        r2Key,
        error: deleteErr instanceof Error ? deleteErr.message : 'Unknown error',
      })),
    );
    throw err;
  }

  return { version: newVersion, vaultId };
}

export async function getHistory(
  db: D1Database,
  householdId: string,
): Promise<VaultHistoryEntry[]> {
  const { results } = await db
    .prepare(
      'SELECT id, version, size_bytes, checksum, created_at FROM vaults WHERE household_id = ? ORDER BY version DESC LIMIT 100',
    )
    .bind(householdId)
    .all<VaultRow>();

  return results.map((row) => ({
    id: row.id,
    version: row.version,
    sizeBytes: row.size_bytes,
    checksum: row.checksum,
    createdAt: row.created_at,
  }));
}

export async function pruneOldVersions(
  db: D1Database,
  bucket: R2Bucket,
  householdId: string,
  keepCount: number,
): Promise<void> {
  // Get all vaults ordered by version desc, skip the first `keepCount`
  const { results } = await db
    .prepare(
      'SELECT id, r2_key FROM vaults WHERE household_id = ? ORDER BY version DESC LIMIT -1 OFFSET ?',
    )
    .bind(householdId, keepCount)
    .all<{ id: string; r2_key: string }>();

  if (results.length === 0) {
    return;
  }

  // Delete R2 objects
  const r2Keys = results.map((r) => r.r2_key);
  await bucket.delete(r2Keys);

  // Delete vault records
  const ids = results.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(', ');
  await db
    .prepare(`DELETE FROM vaults WHERE id IN (${placeholders}) AND household_id = ?`)
    .bind(...ids, householdId)
    .run();
}

export interface StorageSummary {
  totalBytes: number;
  versionCount: number;
}

/** Per household, not per user. Two partners now share the quota one person used to
 *  have to themselves, so the user-facing copy has to say "household". */
export async function getTotalStorage(
  db: D1Database,
  householdId: string,
): Promise<StorageSummary> {
  const row = await db
    .prepare(
      'SELECT COALESCE(SUM(size_bytes), 0) as total_bytes, COUNT(*) as version_count FROM vaults WHERE household_id = ?',
    )
    .bind(householdId)
    .first<{ total_bytes: number; version_count: number }>();

  return {
    totalBytes: row?.total_bytes ?? 0,
    versionCount: row?.version_count ?? 0,
  };
}

export async function cleanupOrphanedR2Objects(
  db: D1Database,
  bucket: R2Bucket,
): Promise<void> {
  let scanned = 0;
  let deleted = 0;
  let cursor: string | undefined;

  do {
    const listed = await bucket.list({ cursor, limit: 1000 });
    const keys = listed.objects.map((obj) => obj.key);
    scanned += keys.length;

    if (keys.length > 0) {
      // Extract vault IDs from R2 keys (format: {householdId}/{vaultId})
      const vaultIds = keys.map((key) => key.split('/')[1]).filter(Boolean) as string[];

      if (vaultIds.length > 0) {
        // Batch-check which vault IDs exist in the DB
        const placeholders = vaultIds.map(() => '?').join(', ');
        const { results } = await db
          .prepare(`SELECT id FROM vaults WHERE id IN (${placeholders})`)
          .bind(...vaultIds)
          .all<{ id: string }>();

        const existingIds = new Set(results.map((r) => r.id));

        // Find orphaned keys (R2 objects with no matching DB record)
        const orphanedKeys = keys.filter((key) => {
          const vaultId = key.split('/')[1];
          return vaultId && !existingIds.has(vaultId);
        });

        if (orphanedKeys.length > 0) {
          await bucket.delete(orphanedKeys);
          deleted += orphanedKeys.length;
        }
      }
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  console.info(JSON.stringify({ event: 'orphan_cleanup', scanned, deleted }));
}

/** Tear down a household's vault entirely. Called when the last member deletes their
 *  account — `households` has no foreign key to `users`, so nothing cascades here on
 *  its own and the rows have to be removed explicitly. */
export async function deleteAllForHousehold(
  db: D1Database,
  bucket: R2Bucket,
  householdId: string,
): Promise<void> {
  // Get all R2 keys for this household
  const { results } = await db
    .prepare('SELECT r2_key FROM vaults WHERE household_id = ?')
    .bind(householdId)
    .all<{ r2_key: string }>();

  // Atomic batch: delete sync_state before vaults due to foreign key
  await db.batch([
    db.prepare('DELETE FROM sync_state WHERE household_id = ?').bind(householdId),
    db.prepare('DELETE FROM vaults WHERE household_id = ?').bind(householdId),
  ]);

  // Delete R2 objects (best-effort after DB records are gone)
  if (results.length > 0) {
    const r2Keys = results.map((r) => r.r2_key);
    await bucket.delete(r2Keys);
  }
}
