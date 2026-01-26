import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { BudgetLine } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:budgetLines';
const USER_ID = 'local';

export function useBudgetLines(periodId: string | null) {
  const [allBudgetLines, setBudgetLines] = useLocalStorage<BudgetLine[]>(STORAGE_KEY, []);

  // Filter to current period
  const budgetLines = useMemo(
    () => (periodId ? allBudgetLines.filter((bl) => bl.periodId === periodId) : []),
    [allBudgetLines, periodId],
  );

  const getBudgetForCategory = useCallback(
    (categoryId: string) => {
      return budgetLines.find((bl) => bl.categoryId === categoryId)?.amountCents ?? 0;
    },
    [budgetLines],
  );

  const setBudgetForCategory = useCallback(
    (categoryId: string, amountCents: number) => {
      if (!periodId) return;

      const existing = allBudgetLines.find(
        (bl) => bl.periodId === periodId && bl.categoryId === categoryId,
      );

      if (existing) {
        // Update existing
        setBudgetLines((prev) =>
          prev.map((bl) => (bl.id === existing.id ? { ...bl, amountCents, updatedAt: now() } : bl)),
        );
      } else {
        // Create new
        const timestamp = now();
        const newBudgetLine: BudgetLine = {
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          periodId,
          categoryId,
          amountCents,
        };
        setBudgetLines((prev) => [...prev, newBudgetLine]);
      }
    },
    [allBudgetLines, periodId, setBudgetLines],
  );

  const deleteBudgetLine = useCallback(
    (id: string) => {
      setBudgetLines((prev) => prev.filter((bl) => bl.id !== id));
    },
    [setBudgetLines],
  );

  return {
    budgetLines,
    getBudgetForCategory,
    setBudgetForCategory,
    deleteBudgetLine,
  };
}
