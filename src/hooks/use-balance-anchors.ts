import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { BalanceAnchor, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const USER_ID = 'local';

export function useBalanceAnchors() {
  const rawAnchors = useLiveQuery(() => db.balanceAnchors.toArray(), []) ?? [];

  const isLoading = rawAnchors === undefined;

  // Sort anchors by date descending (most recent first)
  const sortedAnchors = useMemo(
    () => [...rawAnchors].sort((a, b) => b.date.localeCompare(a.date)),
    [rawAnchors],
  );

  // Get the earliest anchor date (for warning about data before anchors)
  const earliestAnchorDate = useMemo(() => {
    if (sortedAnchors.length === 0) return null;
    const earliest = sortedAnchors[sortedAnchors.length - 1];
    return earliest ? earliest.date : null;
  }, [sortedAnchors]);

  // Get the active anchor for a given date (latest anchor on or before that date)
  const getActiveAnchor = useCallback(
    (asOfDate: string): BalanceAnchor | null => {
      for (const anchor of sortedAnchors) {
        if (anchor.date <= asOfDate) {
          return anchor;
        }
      }
      return null;
    },
    [sortedAnchors],
  );

  const addAnchor = useCallback(
    async (data: CreateEntity<BalanceAnchor>) => {
      // Check for existing anchor on same date
      const existingOnDate = rawAnchors.find((a) => a.date === data.date);
      if (existingOnDate) {
        throw new Error('An anchor already exists for this date');
      }

      const timestamp = now();
      const newAnchor: BalanceAnchor = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      await db.balanceAnchors.add(newAnchor);
      return newAnchor;
    },
    [rawAnchors],
  );

  const updateAnchor = useCallback(
    async (id: string, updates: Partial<Omit<BalanceAnchor, 'id' | 'userId' | 'createdAt'>>) => {
      // If updating date, check for conflicts
      if (updates.date) {
        const existingOnDate = rawAnchors.find((a) => a.date === updates.date && a.id !== id);
        if (existingOnDate) {
          throw new Error('An anchor already exists for this date');
        }
      }

      await db.balanceAnchors.update(id, { ...updates, updatedAt: now() });
    },
    [rawAnchors],
  );

  const deleteAnchor = useCallback(async (id: string) => {
    await db.balanceAnchors.delete(id);
  }, []);

  return {
    anchors: sortedAnchors,
    earliestAnchorDate,
    isLoading,
    getActiveAnchor,
    addAnchor,
    updateAnchor,
    deleteAnchor,
  };
}
