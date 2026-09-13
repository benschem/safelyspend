import { useState, useCallback, useSyncExternalStore } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { decryptVault, encryptVault, isWrongKey } from '@/lib/key-management';
import { getMasterKey, isVaultUnlocked, lockKeyVault } from '@/lib/key-vault';
import { exportAllData, importAllData } from '@/lib/db';
import { validateImport } from '@/lib/import-schema';
import { STORAGE_KEYS } from '@/lib/storage-keys';
import type { BudgetData, MasterKey } from '@/lib/types';

type SyncStatus = 'idle' | 'pushing' | 'pulling';

interface ConflictInfo {
  localVersion: number;
  remoteVersion: number;
}

interface UseSyncReturn {
  /** Whether this session holds a MasterKey — see `key-vault.ts`. */
  isUnlocked: boolean;
  /**
   * Unlock the session from the account password.
   *
   * Not implemented until Phase 5: unlocking means fetching the user's wrapped
   * key rows, deriving KEK_pwd and unwrapping, and none of those endpoints
   * exist yet. Throws rather than failing quietly.
   */
  unlockWithPassword: (password: string) => Promise<void>;
  /** Drop the MasterKey. Does not touch the server session (overview Q6). */
  lock: () => void;
  /** Current sync operation status */
  syncStatus: SyncStatus;
  /** Conflict info if a push was rejected */
  conflict: ConflictInfo | null;
  /** Clear conflict state */
  clearConflict: () => void;
  /** Local version number */
  localVersion: number;
  /** Last synced timestamp */
  lastSyncedAt: string | null;
  /** Push local data to cloud */
  push: (force?: boolean) => Promise<{ version: number }>;
  /** Pull cloud data to local */
  pull: () => Promise<void>;
}

function getStoredVersion(): number {
  const stored = localStorage.getItem(STORAGE_KEYS.SYNC_LOCAL_VERSION);
  return stored ? parseInt(stored, 10) : 0;
}

function setStoredVersion(version: number): void {
  localStorage.setItem(STORAGE_KEYS.SYNC_LOCAL_VERSION, String(version));
}

function getStoredLastSyncedAt(): string | null {
  return localStorage.getItem(STORAGE_KEYS.SYNC_LAST_SYNCED_AT);
}

function setStoredLastSyncedAt(timestamp: string): void {
  localStorage.setItem(STORAGE_KEYS.SYNC_LAST_SYNCED_AT, timestamp);
}

/**
 * Shown verbatim by `login.tsx` and `settings.tsx`. Phase 3 deliberately ships
 * the sync controls in a knowingly broken state rather than behind a flag —
 * see the step 6 decision in `docs/auth-rewrite/03_client_crypto_rewrite.md` —
 * so this message is the whole of the unlock user experience until Phase 5.
 */
const VAULT_REBUILDING_MESSAGE = 'Cloud sync is being rebuilt and cannot be unlocked yet.';

/**
 * The key vault is a module-level variable rather than React state, so every
 * `useSync` caller has to be told when it changes. Subscribers are held here
 * and notified on lock; Phase 5 notifies on unlock through the same path.
 */
const unlockListeners = new Set<() => void>();

function subscribeToUnlockState(listener: () => void): () => void {
  unlockListeners.add(listener);
  return () => {
    unlockListeners.delete(listener);
  };
}

function notifyUnlockStateChanged(): void {
  unlockListeners.forEach((listener) => listener());
}

function requireMasterKey(): MasterKey {
  const masterKey = getMasterKey();
  if (!masterKey) {
    throw new Error('Vault is locked');
  }
  return masterKey;
}

export function useSync(): UseSyncReturn {
  const isUnlocked = useSyncExternalStore(subscribeToUnlockState, isVaultUnlocked);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [localVersion, setLocalVersion] = useState(getStoredVersion);
  const [lastSyncedAt, setLastSyncedAt] = useState(getStoredLastSyncedAt);

  // Takes no parameter yet, which still satisfies the one-argument type above.
  // Phase 5 adds `password` back when there is something to derive from it,
  // and replaces this body: GET the wrapped key rows, deriveKek against the
  // returned kek_salt, unwrapMasterKey, unwrapPrivateKey, put both in the key
  // vault, then notifyUnlockStateChanged().
  const unlockWithPassword = useCallback(
    (): Promise<void> => Promise.reject(new Error(VAULT_REBUILDING_MESSAGE)),
    [],
  );

  const lock = useCallback(() => {
    lockKeyVault();
    notifyUnlockStateChanged();
  }, []);

  const push = useCallback(async (force?: boolean): Promise<{ version: number }> => {
    const masterKey = requireMasterKey();

    setSyncStatus('pushing');
    setConflict(null);

    try {
      const backup = await exportAllData();
      const encrypted = await encryptVault(masterKey, backup);

      let expectedVersion = getStoredVersion();
      if (force) {
        // Use current remote version as expected version
        const metadata = await api.vault.getMetadata();
        expectedVersion = metadata.version;
      }

      const result = await api.vault.putData(encrypted.buffer as ArrayBuffer, expectedVersion);

      setStoredVersion(result.version);
      setLocalVersion(result.version);
      const now = new Date().toISOString();
      setStoredLastSyncedAt(now);
      setLastSyncedAt(now);

      return result;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const remoteVersion = (err.data as { currentVersion?: number })?.currentVersion ?? 0;
        setConflict({
          localVersion: getStoredVersion(),
          remoteVersion,
        });
        throw err;
      }
      throw err;
    } finally {
      setSyncStatus('idle');
    }
  }, []);

  const pull = useCallback(async (): Promise<void> => {
    const masterKey = requireMasterKey();

    setSyncStatus('pulling');
    setConflict(null);

    try {
      const { data: encryptedData, version } = await api.vault.getData();
      const backup = await decryptVault(masterKey, new Uint8Array(encryptedData));

      // Validate using existing Zod schema
      const validated = validateImport(backup);

      // Import into IndexedDB
      await importAllData(
        validated as unknown as BudgetData & { activeScenarioId?: string | null },
      );

      setStoredVersion(version);
      setLocalVersion(version);
      const now = new Date().toISOString();
      setStoredLastSyncedAt(now);
      setLastSyncedAt(now);
    } catch (err) {
      if (isWrongKey(err)) {
        throw new Error('Could not decrypt the vault with this key.');
      }
      throw err;
    } finally {
      setSyncStatus('idle');
    }
  }, []);

  return {
    isUnlocked,
    unlockWithPassword,
    lock,
    syncStatus,
    conflict,
    clearConflict: () => setConflict(null),
    localVersion,
    lastSyncedAt,
    push,
    pull,
  };
}
