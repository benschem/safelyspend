import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { SavingsAnchor, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const USER_ID = 'local';

export function useSavingsAnchors() {
  const queryResult = useLiveQuery(() => db.savingsAnchors.toArray(), []);
  const rawAnchors = useMemo(() => queryResult ?? [], [queryResult]);

  const isLoading = queryResult === undefined;

  // Sort anchors by goal ID then date descending (most recent first within each goal)
  const sortedAnchors = useMemo(
    () =>
      [...rawAnchors].sort((a, b) => {
        // First sort by goal ID
        const goalCompare = a.savingsGoalId.localeCompare(b.savingsGoalId);
        if (goalCompare !== 0) return goalCompare;
        // Then by date descending
        return b.date.localeCompare(a.date);
      }),
    [rawAnchors],
  );

  // Get anchors for a specific goal, sorted by date descending
  const getAnchorsForGoal = useCallback(
    (goalId: string): SavingsAnchor[] => {
      return sortedAnchors.filter((a) => a.savingsGoalId === goalId);
    },
    [sortedAnchors],
  );

  // Get the active anchor for a given goal and date (latest anchor on or before that date)
  const getActiveAnchor = useCallback(
    (goalId: string, asOfDate: string): SavingsAnchor | null => {
      const goalAnchors = getAnchorsForGoal(goalId);
      for (const anchor of goalAnchors) {
        if (anchor.date <= asOfDate) {
          return anchor;
        }
      }
      return null;
    },
    [getAnchorsForGoal],
  );

  // Get the earliest anchor date for a specific goal
  const getEarliestAnchorDate = useCallback(
    (goalId: string): string | null => {
      const goalAnchors = getAnchorsForGoal(goalId);
      if (goalAnchors.length === 0) return null;
      const earliest = goalAnchors[goalAnchors.length - 1];
      return earliest ? earliest.date : null;
    },
    [getAnchorsForGoal],
  );

  const addAnchor = useCallback(
    async (data: CreateEntity<SavingsAnchor>) => {
      // Check for existing anchor on same date for same goal
      const existingOnDate = rawAnchors.find(
        (a) => a.savingsGoalId === data.savingsGoalId && a.date === data.date,
      );
      if (existingOnDate) {
        throw new Error('This savings goal already has a balance set for this date. Edit the existing one or choose a different date.');
      }

      const timestamp = now();
      const newAnchor: SavingsAnchor = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      await db.savingsAnchors.add(newAnchor);
      return newAnchor;
    },
    [rawAnchors],
  );

  const updateAnchor = useCallback(
    async (id: string, updates: Partial<Omit<SavingsAnchor, 'id' | 'userId' | 'createdAt'>>) => {
      // If updating date or goal, check for conflicts
      if (updates.date || updates.savingsGoalId) {
        const anchor = rawAnchors.find((a) => a.id === id);
        if (anchor) {
          const newGoalId = updates.savingsGoalId ?? anchor.savingsGoalId;
          const newDate = updates.date ?? anchor.date;
          const existingOnDate = rawAnchors.find(
            (a) => a.savingsGoalId === newGoalId && a.date === newDate && a.id !== id,
          );
          if (existingOnDate) {
            throw new Error('This savings goal already has a balance set for this date. Edit the existing one or choose a different date.');
          }
        }
      }

      await db.savingsAnchors.update(id, { ...updates, updatedAt: now() });
    },
    [rawAnchors],
  );

  const deleteAnchor = useCallback(async (id: string) => {
    await db.savingsAnchors.delete(id);
  }, []);

  // Delete all anchors for a specific goal (used when deleting a goal)
  const deleteAnchorsForGoal = useCallback(async (goalId: string) => {
    await db.savingsAnchors.where('savingsGoalId').equals(goalId).delete();
  }, []);

  return {
    anchors: sortedAnchors,
    isLoading,
    getAnchorsForGoal,
    getActiveAnchor,
    getEarliestAnchorDate,
    addAnchor,
    updateAnchor,
    deleteAnchor,
    deleteAnchorsForGoal,
  };
}
