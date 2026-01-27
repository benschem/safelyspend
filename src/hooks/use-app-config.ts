import { useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';

const STORAGE_KEY = 'budget:appConfig';

interface AppConfig {
  isInitialized: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  isInitialized: false,
};

/**
 * Hook for managing app initialization state
 * isInitialized is false until the first-run wizard completes
 */
export function useAppConfig() {
  const [config, setConfig] = useLocalStorage<AppConfig>(STORAGE_KEY, DEFAULT_CONFIG);

  const markInitialized = useCallback(() => {
    setConfig((prev) => ({ ...prev, isInitialized: true }));
  }, [setConfig]);

  return {
    isInitialized: config.isInitialized,
    markInitialized,
  };
}
