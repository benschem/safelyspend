import { useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { Period, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:periods';
const ACTIVE_PERIOD_KEY = 'budget:activePeriodId';
const USER_ID = 'local'; // Placeholder for future multi-user support

export function usePeriods() {
  const [periods, setPeriods] = useLocalStorage<Period[]>(STORAGE_KEY, []);
  const [activePeriodId, setActivePeriodId] = useLocalStorage<string | null>(
    ACTIVE_PERIOD_KEY,
    null,
  );

  const addPeriod = useCallback(
    (data: CreateEntity<Period>) => {
      const timestamp = now();
      const newPeriod: Period = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      setPeriods((prev) => [...prev, newPeriod]);
      // Auto-select if first period
      if (periods.length === 0) {
        setActivePeriodId(newPeriod.id);
      }
      return newPeriod;
    },
    [periods.length, setPeriods, setActivePeriodId],
  );

  const updatePeriod = useCallback(
    (id: string, updates: Partial<Omit<Period, 'id' | 'userId' | 'createdAt'>>) => {
      setPeriods((prev) =>
        prev.map((period) =>
          period.id === id ? { ...period, ...updates, updatedAt: now() } : period,
        ),
      );
    },
    [setPeriods],
  );

  const deletePeriod = useCallback(
    (id: string) => {
      setPeriods((prev) => prev.filter((period) => period.id !== id));
      if (activePeriodId === id) {
        setActivePeriodId(null);
      }
    },
    [activePeriodId, setPeriods, setActivePeriodId],
  );

  const getActivePeriod = useCallback(() => {
    return periods.find((p) => p.id === activePeriodId) ?? null;
  }, [periods, activePeriodId]);

  return {
    periods,
    activePeriodId,
    setActivePeriodId,
    addPeriod,
    updatePeriod,
    deletePeriod,
    getActivePeriod,
  };
}
