import { useCallback, useMemo } from 'react';
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
  const rawSavingsGoals = useLiveQuery(() => db.savingsGoals.toArray(), []);
  const savingsGoals = useMemo(() => rawSavingsGoals ?? [], [rawSavingsGoals]);

  const isLoading = rawSavingsGoals === undefined;

  // Get the current emergency fund goal (if any)
  const emergencyFund = useMemo(
    () => savingsGoals.find((goal) => goal.isEmergencyFund) ?? null,
    [savingsGoals],
  );

  const addSavingsGoal = useCallback(async (data: CreateEntity<SavingsGoal>) => {
    // If this goal is being set as emergency fund, clear the flag from any existing one
    if (data.isEmergencyFund) {
      const existingEmergencyFund = await db.savingsGoals.filter((g) => g.isEmergencyFund === true).first();
      if (existingEmergencyFund) {
        await db.savingsGoals.update(existingEmergencyFund.id, { isEmergencyFund: false, updatedAt: now() });
      }
    }

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
      // If this goal is being set as emergency fund, clear the flag from any existing one
      if (updates.isEmergencyFund) {
        const existingEmergencyFund = await db.savingsGoals.filter((g) => g.isEmergencyFund === true && g.id !== id).first();
        if (existingEmergencyFund) {
          await db.savingsGoals.update(existingEmergencyFund.id, { isEmergencyFund: false, updatedAt: now() });
        }
      }

      await db.savingsGoals.update(id, { ...updates, updatedAt: now() });
    },
    [],
  );

  const deleteSavingsGoal = useCallback(async (id: string) => {
    // Delete associated savings anchors first
    await db.savingsAnchors.where('savingsGoalId').equals(id).delete();
    // Then delete the goal
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
    emergencyFund,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    getSavingsGoal,
  };
}
