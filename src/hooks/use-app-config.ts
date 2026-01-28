import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type AppConfig } from '@/lib/db';

const DEFAULT_CONFIG: AppConfig = {
  id: 'singleton',
  isInitialized: false,
  isDemo: false,
};

/**
 * Hook for managing app initialization state
 * isInitialized is false until the first-run wizard completes
 * isDemo is true when running with demo data
 */
export function useAppConfig() {
  // Wrap result to distinguish "loading" (undefined) from "not found" (null)
  const result = useLiveQuery(async () => {
    const config = await db.appConfig.get('singleton');
    return config ?? null; // null = not found, undefined = still loading
  }, []);

  const isLoading = result === undefined;
  const config = result ?? DEFAULT_CONFIG;

  const markInitialized = useCallback(async (isDemo: boolean = false) => {
    await db.appConfig.put({
      id: 'singleton',
      isInitialized: true,
      isDemo,
    });
  }, []);

  const resetApp = useCallback(async () => {
    await db.appConfig.put(DEFAULT_CONFIG);
  }, []);

  return {
    isInitialized: config?.isInitialized ?? false,
    isDemo: config?.isDemo ?? false,
    isLoading,
    markInitialized,
    resetApp,
  };
}
