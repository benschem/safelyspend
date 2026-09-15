import { useState, useCallback, useSyncExternalStore } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { unlockKeyBundle } from '@/lib/account';
import { decryptVault, encryptVault, isWrongKey } from '@/lib/key-management';
import {
  getMasterKey,
  isVaultUnlocked,
  lockKeyVault,
  subscribeToVaultState,
  unlockKeyVault,
} from '@/lib/key-vault';
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
   * Unlock the session from the account password, against a server session
   * that is already live.
   *
   * No OTP and no bridge token: the JWT is what authorises the key-bundle
   * fetch, and the password only has to open the wrapped rows it returns. The
   * two lifetimes are independent in both directions (overview Q6).
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

function requireMasterKey(): MasterKey {
  const masterKey = getMasterKey();
  if (!masterKey) {
    throw new Error('Vault is locked');
  }
  return masterKey;
}

export function useSync(): UseSyncReturn {
  const isUnlocked = useSyncExternalStore(subscribeToVaultState, isVaultUnlocked);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [localVersion, setLocalVersion] = useState(getStoredVersion);
  const [lastSyncedAt, setLastSyncedAt] = useState(getStoredLastSyncedAt);

  const unlockWithPassword = useCallback(async (password: string): Promise<void> => {
    // A wrong password leaves unlockKeyBundle as a WrongPasswordError, which
    // the caller branches on; nothing needs translating here.
    const bundle = await api.auth.keyBundle();
    unlockKeyVault(await unlockKeyBundle(password, bundle));
  }, []);

  const lock = useCallback(() => {
    lockKeyVault();
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
