import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { BalanceAnchor, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:balanceAnchors';
const USER_ID = 'local';

export function useBalanceAnchors() {
  const [anchors, setAnchors] = useLocalStorage<BalanceAnchor[]>(STORAGE_KEY, []);

  // Sort anchors by date descending (most recent first)
  const sortedAnchors = useMemo(
    () => [...anchors].sort((a, b) => b.date.localeCompare(a.date)),
    [anchors],
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
    (data: CreateEntity<BalanceAnchor>) => {
      // Check for existing anchor on same date
      const existingOnDate = anchors.find((a) => a.date === data.date);
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
      setAnchors((prev) => [...prev, newAnchor]);
      return newAnchor;
    },
    [anchors, setAnchors],
  );

  const updateAnchor = useCallback(
    (id: string, updates: Partial<Omit<BalanceAnchor, 'id' | 'userId' | 'createdAt'>>) => {
      // If updating date, check for conflicts
      if (updates.date) {
        const existingOnDate = anchors.find((a) => a.date === updates.date && a.id !== id);
        if (existingOnDate) {
          throw new Error('An anchor already exists for this date');
        }
      }

      setAnchors((prev) =>
        prev.map((anchor) =>
          anchor.id === id ? { ...anchor, ...updates, updatedAt: now() } : anchor,
        ),
      );
    },
    [anchors, setAnchors],
  );

  const deleteAnchor = useCallback(
    (id: string) => {
      setAnchors((prev) => prev.filter((anchor) => anchor.id !== id));
    },
    [setAnchors],
  );

  return {
    anchors: sortedAnchors,
    earliestAnchorDate,
    getActiveAnchor,
    addAnchor,
    updateAnchor,
    deleteAnchor,
  };
}
