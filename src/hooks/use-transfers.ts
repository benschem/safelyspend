import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { Transfer, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:transfers';
const USER_ID = 'local';

/**
 * Hook for managing transfers
 * Transfers are global facts - filtering is done by date range
 */
export function useTransfers(startDate?: string, endDate?: string) {
  const [allTransfers, setTransfers] = useLocalStorage<Transfer[]>(STORAGE_KEY, []);

  // Filter to transfers within the date range
  const transfers = useMemo(() => {
    if (!startDate || !endDate) return allTransfers;
    return allTransfers.filter((t) => t.date >= startDate && t.date <= endDate);
  }, [allTransfers, startDate, endDate]);

  // Get transfers up to a specific date (for balance calculations)
  const getTransfersUpTo = useCallback(
    (date: string) => {
      return allTransfers.filter((t) => t.date <= date);
    },
    [allTransfers],
  );

  // Get transfers for a specific account up to a date
  const getAccountTransfersUpTo = useCallback(
    (accountId: string, date: string) => {
      return allTransfers.filter(
        (t) => (t.fromAccountId === accountId || t.toAccountId === accountId) && t.date <= date,
      );
    },
    [allTransfers],
  );

  const addTransfer = useCallback(
    (data: CreateEntity<Transfer>) => {
      const timestamp = now();
      const newTransfer: Transfer = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      setTransfers((prev) => [...prev, newTransfer]);
      return newTransfer;
    },
    [setTransfers],
  );

  const updateTransfer = useCallback(
    (id: string, updates: Partial<Omit<Transfer, 'id' | 'userId' | 'createdAt'>>) => {
      setTransfers((prev) =>
        prev.map((transfer) =>
          transfer.id === id ? { ...transfer, ...updates, updatedAt: now() } : transfer,
        ),
      );
    },
    [setTransfers],
  );

  const deleteTransfer = useCallback(
    (id: string) => {
      setTransfers((prev) => prev.filter((transfer) => transfer.id !== id));
    },
    [setTransfers],
  );

  return {
    allTransfers,
    transfers,
    getTransfersUpTo,
    getAccountTransfersUpTo,
    addTransfer,
    updateTransfer,
    deleteTransfer,
  };
}
