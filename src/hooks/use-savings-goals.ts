import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { SavingsGoal, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:savingsGoals';
const USER_ID = 'local';

export function useSavingsGoals(periodId: string | null) {
  const [allSavingsGoals, setSavingsGoals] = useLocalStorage<SavingsGoal[]>(STORAGE_KEY, []);

  // Filter to current period or global goals (periodId === null)
  const savingsGoals = useMemo(
    () => allSavingsGoals.filter((sg) => sg.periodId === periodId || sg.periodId === null),
    [allSavingsGoals, periodId],
  );

  const globalGoals = useMemo(
    () => allSavingsGoals.filter((sg) => sg.periodId === null),
    [allSavingsGoals],
  );

  const periodGoals = useMemo(
    () => (periodId ? allSavingsGoals.filter((sg) => sg.periodId === periodId) : []),
    [allSavingsGoals, periodId],
  );

  const addSavingsGoal = useCallback(
    (data: CreateEntity<SavingsGoal>) => {
      const timestamp = now();
      const newGoal: SavingsGoal = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      setSavingsGoals((prev) => [...prev, newGoal]);
      return newGoal;
    },
    [setSavingsGoals],
  );

  const updateSavingsGoal = useCallback(
    (id: string, updates: Partial<Omit<SavingsGoal, 'id' | 'userId' | 'createdAt'>>) => {
      setSavingsGoals((prev) =>
        prev.map((goal) => (goal.id === id ? { ...goal, ...updates, updatedAt: now() } : goal)),
      );
    },
    [setSavingsGoals],
  );

  const deleteSavingsGoal = useCallback(
    (id: string) => {
      setSavingsGoals((prev) => prev.filter((goal) => goal.id !== id));
    },
    [setSavingsGoals],
  );

  return {
    savingsGoals,
    globalGoals,
    periodGoals,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
  };
}
