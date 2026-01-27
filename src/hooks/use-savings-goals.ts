import { useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { SavingsGoal, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:savingsGoals';
const USER_ID = 'local';

/**
 * Hook for managing savings goals
 * Savings goals are global (not tied to scenarios or periods)
 */
export function useSavingsGoals() {
  const [savingsGoals, setSavingsGoals] = useLocalStorage<SavingsGoal[]>(STORAGE_KEY, []);

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

  const getSavingsGoal = useCallback(
    (id: string) => {
      return savingsGoals.find((goal) => goal.id === id) ?? null;
    },
    [savingsGoals],
  );

  return {
    savingsGoals,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    getSavingsGoal,
  };
}
