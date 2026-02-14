import { useState, useRef, useCallback } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { encrypt, decrypt, isWrongPassphrase } from '@/lib/e2e-crypto';
import { exportAllData, importAllData } from '@/lib/db';
import { validateImport } from '@/lib/import-schema';
import { STORAGE_KEYS } from '@/lib/storage-keys';
import type { BudgetData } from '@/lib/types';

type SyncStatus = 'idle' | 'pushing' | 'pulling';

interface ConflictInfo {
  localVersion: number;
  remoteVersion: number;
}

interface UseSyncReturn {
  /** Whether a passphrase has been entered this session */
  hasPassphrase: boolean;
  /** Set the passphrase for this session */
  setPassphrase: (passphrase: string) => void;
  /** Clear the passphrase */
  clearPassphrase: () => void;
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

export function useSync(): UseSyncReturn {
  const passphraseRef = useRef<string | null>(null);
  const [hasPassphrase, setHasPassphrase] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [localVersion, setLocalVersion] = useState(getStoredVersion);
  const [lastSyncedAt, setLastSyncedAt] = useState(getStoredLastSyncedAt);

  const setPassphrase = useCallback((passphrase: string) => {
    passphraseRef.current = passphrase;
    setHasPassphrase(true);
  }, []);

  const clearPassphrase = useCallback(() => {
    passphraseRef.current = null;
    setHasPassphrase(false);
  }, []);

  const push = useCallback(
    async (force?: boolean): Promise<{ version: number }> => {
      if (!passphraseRef.current) {
        throw new Error('Passphrase not set');
      }

      setSyncStatus('pushing');
      setConflict(null);

      try {
        const backup = await exportAllData();
        const encrypted = await encrypt(backup, passphraseRef.current);

        let expectedVersion = getStoredVersion();
        if (force) {
          // Use current remote version as expected version
          const metadata = await api.vault.getMetadata();
          expectedVersion = metadata.version;
        }

        const result = await api.vault.putData(encrypted, expectedVersion);

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
    },
    [],
  );

  const pull = useCallback(async (): Promise<void> => {
    if (!passphraseRef.current) {
      throw new Error('Passphrase not set');
    }

    setSyncStatus('pulling');
    setConflict(null);

    try {
      const { data: encryptedData, version } = await api.vault.getData();
      const backup = await decrypt(encryptedData, passphraseRef.current);

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
      if (isWrongPassphrase(err)) {
        throw new Error('Wrong passphrase. Please try again.');
      }
      throw err;
    } finally {
      setSyncStatus('idle');
    }
  }, []);

  return {
    hasPassphrase,
    setPassphrase,
    clearPassphrase,
    syncStatus,
    conflict,
    clearConflict: () => setConflict(null),
    localVersion,
    lastSyncedAt,
    push,
    pull,
  };
}
