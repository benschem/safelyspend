import { useState, useEffect, useCallback, useRef } from 'react';
import { STORAGE_SYNC_EVENT } from '@/lib/storage-keys';
import { debug } from '@/lib/debug';

// Counter for generating unique instance IDs
let instanceCounter = 0;

interface StorageSyncDetail {
  key: string;
  value: unknown;
  sourceId: number;
}

/**
 * Hook for persisting UI preferences in localStorage.
 * Data storage is handled by IndexedDB (see db.ts).
 * This hook is only for view state and UI preferences.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  // Unique ID for this hook instance to avoid processing own events
  const instanceId = useRef(++instanceCounter);

  // Initialise state from localStorage or use initial value
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
        } catch (error) {
          debug.error('storage', `Failed to save "${key}" to localStorage`, error);
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
