import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { SavingsGoal, CreateEntity } from '@/lib/types';
import { generateId, now, today } from '@/lib/utils';

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
      const existingEmergencyFund = await db.savingsGoals
        .filter((g) => g.isEmergencyFund === true)
        .first();
      if (existingEmergencyFund) {
        await db.savingsGoals.update(existingEmergencyFund.id, {
          isEmergencyFund: false,
          updatedAt: now(),
        });
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
        const existingEmergencyFund = await db.savingsGoals
          .filter((g) => g.isEmergencyFund === true && g.id !== id)
          .first();
        if (existingEmergencyFund) {
          await db.savingsGoals.update(existingEmergencyFund.id, {
            isEmergencyFund: false,
            updatedAt: now(),
          });
        }
      }

      await db.savingsGoals.where('id').equals(id).modify((goal) => {
        Object.assign(goal, { ...updates, updatedAt: now() });
        // Dexie's update() ignores undefined, so explicitly delete cleared optional fields
        if (updates.deadline === undefined && 'deadline' in updates) delete goal.deadline;
        if (updates.annualInterestRate === undefined && 'annualInterestRate' in updates)
          delete goal.annualInterestRate;
      });
    },
    [],
  );

  const deleteSavingsGoal = useCallback(async (id: string) => {
    const goal = await db.savingsGoals.get(id);

    // Calculate current balance: anchor + transactions after anchor, or sum all
    const todayStr = today();
    const allGoalTransactions = await db.transactions
      .filter((t) => t.type === 'savings' && t.savingsGoalId === id)
      .toArray();

    const anchors = await db.savingsAnchors
      .where('savingsGoalId')
      .equals(id)
      .toArray();
    const activeAnchor = anchors
      .filter((a) => a.date <= todayStr)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    let currentBalance: number;
    if (activeAnchor) {
      const transactionsAfterAnchor = allGoalTransactions.filter(
        (t) => t.date > activeAnchor.date,
      );
      currentBalance =
        activeAnchor.balanceCents +
        transactionsAfterAnchor.reduce((sum, t) => sum + t.amountCents, 0);
    } else {
      currentBalance = allGoalTransactions.reduce((sum, t) => sum + t.amountCents, 0);
    }

    // If there's a positive balance, create a withdrawal to return funds to cash
    if (currentBalance > 0) {
      const timestamp = now();
      await db.transactions.add({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'savings',
        date: todayStr,
        amountCents: -currentBalance,
        description: `Closed "${goal?.name ?? 'savings goal'}"`,
        categoryId: null,
        savingsGoalId: id,
      });
    }

    // Append goal name to orphaned transactions so history remains meaningful
    const goalName = goal?.name ?? 'savings goal';
    await db.transactions
      .filter((t) => t.type === 'savings' && t.savingsGoalId === id)
      .modify((t) => {
        t.description = `${t.description} (${goalName})`;
        t.savingsGoalId = null;
      });

    // Delete associated savings anchors
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
