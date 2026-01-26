import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { OpeningBalance } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:openingBalances';
const USER_ID = 'local';

export function useOpeningBalances(periodId: string | null) {
  const [allOpeningBalances, setOpeningBalances] = useLocalStorage<OpeningBalance[]>(
    STORAGE_KEY,
    [],
  );

  // Filter to current period
  const openingBalances = useMemo(
    () => (periodId ? allOpeningBalances.filter((ob) => ob.periodId === periodId) : []),
    [allOpeningBalances, periodId],
  );

  const getBalanceForAccount = useCallback(
    (accountId: string) => {
      return openingBalances.find((ob) => ob.accountId === accountId)?.amountCents ?? 0;
    },
    [openingBalances],
  );

  const setBalanceForAccount = useCallback(
    (accountId: string, amountCents: number) => {
      if (!periodId) return;

      const existing = allOpeningBalances.find(
        (ob) => ob.periodId === periodId && ob.accountId === accountId,
      );

      if (existing) {
        // Update existing
        setOpeningBalances((prev) =>
          prev.map((ob) => (ob.id === existing.id ? { ...ob, amountCents, updatedAt: now() } : ob)),
        );
      } else {
        // Create new
        const timestamp = now();
        const newOpeningBalance: OpeningBalance = {
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          periodId,
          accountId,
          amountCents,
        };
        setOpeningBalances((prev) => [...prev, newOpeningBalance]);
      }
    },
    [allOpeningBalances, periodId, setOpeningBalances],
  );

  return {
    openingBalances,
    getBalanceForAccount,
    setBalanceForAccount,
  };
}
