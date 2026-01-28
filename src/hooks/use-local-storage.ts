import { useState, useEffect, useCallback, useRef } from 'react';

// Custom event name for cross-component sync
const STORAGE_SYNC_EVENT = 'budget:storage-sync';

// Custom event name for storage quota warnings
export const STORAGE_QUOTA_EVENT = 'budget:storage-quota-warning';

// Counter for generating unique instance IDs
let instanceCounter = 0;

// Track if we've warned about quota in this session
let hasWarnedAboutQuota = false;

interface StorageSyncDetail {
  key: string;
  value: unknown;
  sourceId: number;
}

export interface StorageQuotaDetail {
  usedBytes: number;
  totalBytes: number;
  percentUsed: number;
  isFull: boolean;
}

/**
 * Check localStorage usage and emit warning event if usage is high.
 */
function checkStorageQuota(): void {
  try {
    // Estimate current usage
    let usedBytes = 0;
    for (const key of Object.keys(localStorage)) {
      const value = localStorage.getItem(key);
      if (value) {
        usedBytes += key.length + value.length;
      }
    }
    // Convert to bytes (JS uses UTF-16, so multiply by 2)
    usedBytes *= 2;

    // Typical localStorage limit is 5-10MB, assume 5MB
    const totalBytes = 5 * 1024 * 1024;
    const percentUsed = (usedBytes / totalBytes) * 100;

    // Warn if over 80% usage (and haven't warned yet this session)
    if (percentUsed >= 80 && !hasWarnedAboutQuota) {
      hasWarnedAboutQuota = true;
      window.dispatchEvent(
        new CustomEvent<StorageQuotaDetail>(STORAGE_QUOTA_EVENT, {
          detail: {
            usedBytes,
            totalBytes,
            percentUsed,
            isFull: false,
          },
        }),
      );
    }
  } catch {
    // Ignore errors in quota checking
  }
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Unique ID for this hook instance to avoid processing own events
  const instanceId = useRef(++instanceCounter);

  // Initialize state from localStorage or use initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Listen for sync events from OTHER hook instances only
  useEffect(() => {
    const handleSync = (event: Event) => {
      const { key: eventKey, value, sourceId } = (event as CustomEvent<StorageSyncDetail>).detail;
      // Ignore events from this same instance
      if (sourceId === instanceId.current) return;
      if (eventKey === key) {
        setStoredValue(value as T);
      }
    };

    window.addEventListener(STORAGE_SYNC_EVENT, handleSync);
    return () => window.removeEventListener(STORAGE_SYNC_EVENT, handleSync);
  }, [key]);

  // Wrapper that handles both direct values and updater functions
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue = value instanceof Function ? value(prev) : value;

        // Persist to localStorage
        try {
          window.localStorage.setItem(key, JSON.stringify(nextValue));

          // Check quota after successful save
          checkStorageQuota();
        } catch (error) {
          // Handle quota exceeded error
          if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            console.error(`localStorage quota exceeded while saving "${key}"`);
            // Emit event for UI to handle
            window.dispatchEvent(
              new CustomEvent<StorageQuotaDetail>(STORAGE_QUOTA_EVENT, {
                detail: {
                  usedBytes: 0,
                  totalBytes: 0,
                  percentUsed: 100,
                  isFull: true,
                },
              }),
            );
          } else {
            console.error(`Failed to save "${key}" to localStorage:`, error);
          }
        }

        // Dispatch sync event for other hook instances (include our ID so we ignore it)
        window.dispatchEvent(
          new CustomEvent<StorageSyncDetail>(STORAGE_SYNC_EVENT, {
            detail: { key, value: nextValue, sourceId: instanceId.current },
          }),
        );

        return nextValue;
      });
    },
    [key],
  );

  return [storedValue, setValue] as const;
}
