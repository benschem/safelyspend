import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type AppConfig } from '@/lib/db';
import { today } from '@/lib/utils';

const DEFAULT_CONFIG: AppConfig = {
  id: 'singleton',
  isInitialized: false,
  isDemo: false,
};

/**
 * Calculate the number of days between two ISO date strings
 */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Get the number of days for a check-in cadence
 */
function cadenceDays(cadence: string): number {
  switch (cadence) {
    case 'weekly':
      return 7;
    case 'fortnightly':
      return 14;
    case 'monthly':
      return 30;
    case 'quarterly':
      return 90;
    default:
      return 30;
  }
}

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

  const setCheckInCadence = useCallback(
    async (cadence: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly') => {
      const current = await db.appConfig.get('singleton');
      await db.appConfig.put({
        ...DEFAULT_CONFIG,
        ...current,
        checkInCadence: cadence,
      });
    },
    [],
  );

  const markCheckInComplete = useCallback(async () => {
    const current = await db.appConfig.get('singleton');
    await db.appConfig.put({
      ...DEFAULT_CONFIG,
      ...current,
      lastCheckInDate: today(),
    });
  }, []);

  const daysSinceLastCheckIn = useMemo((): number | null => {
    if (!config?.lastCheckInDate) return null;
    return daysBetween(config.lastCheckInDate, today());
  }, [config?.lastCheckInDate]);

  const isCheckInDue = useMemo((): boolean => {
    if (!config?.checkInCadence) return false;
    if (!config?.lastCheckInDate) return true;
    const elapsed = daysBetween(config.lastCheckInDate, today());
    return elapsed >= cadenceDays(config.checkInCadence);
  }, [config?.checkInCadence, config?.lastCheckInDate]);

  return {
    isInitialized: config?.isInitialized ?? false,
    isDemo: config?.isDemo ?? false,
    isLoading,
    checkInCadence: config?.checkInCadence ?? null,
    lastCheckInDate: config?.lastCheckInDate ?? null,
    daysSinceLastCheckIn,
    isCheckInDue,
    markInitialized,
    resetApp,
    setCheckInCadence,
    markCheckInComplete,
  };
}
