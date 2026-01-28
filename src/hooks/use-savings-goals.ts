import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { SavingsGoal, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const USER_ID = 'local';

/**
 * Hook for managing savings goals
 * Savings goals are global (not tied to scenarios or periods)
 */
export function useSavingsGoals() {
  const savingsGoals = useLiveQuery(() => db.savingsGoals.toArray(), []) ?? [];

  const isLoading = savingsGoals === undefined;

  const addSavingsGoal = useCallback(async (data: CreateEntity<SavingsGoal>) => {
    const timestamp = now();
    const newGoal: SavingsGoal = {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...data,
    };
    await db.savingsGoals.add(newGoal);
    return newGoal;
  }, []);

  const updateSavingsGoal = useCallback(
    async (id: string, updates: Partial<Omit<SavingsGoal, 'id' | 'userId' | 'createdAt'>>) => {
      await db.savingsGoals.update(id, { ...updates, updatedAt: now() });
    },
    [],
  );

  const deleteSavingsGoal = useCallback(async (id: string) => {
    await db.savingsGoals.delete(id);
  }, []);

  const getSavingsGoal = useCallback(
    (id: string) => {
      return savingsGoals.find((goal) => goal.id === id) ?? null;
    },
    [savingsGoals],
  );

  return {
    savingsGoals,
    isLoading,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    getSavingsGoal,
  };
}
