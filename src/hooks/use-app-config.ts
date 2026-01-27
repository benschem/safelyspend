import { useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';

const STORAGE_KEY = 'budget:appConfig';

interface AppConfig {
  isInitialized: boolean;
  isDemo: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  isInitialized: false,
  isDemo: false,
};

/**
 * Hook for managing app initialization state
 * isInitialized is false until the first-run wizard completes
 * isDemo is true when running with demo data
 */
export function useAppConfig() {
  const [config, setConfig] = useLocalStorage<AppConfig>(STORAGE_KEY, DEFAULT_CONFIG);

  const markInitialized = useCallback(
    (isDemo: boolean = false) => {
      setConfig((prev) => ({ ...prev, isInitialized: true, isDemo }));
    },
    [setConfig],
  );

  const resetApp = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, [setConfig]);

  return {
    isInitialized: config.isInitialized,
    isDemo: config.isDemo,
    markInitialized,
    resetApp,
  };
}
