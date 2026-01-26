import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { Transfer, CreateEntity, Period } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:transfers';
const USER_ID = 'local';

export function useTransfers(period: Period | null) {
  const [allTransfers, setTransfers] = useLocalStorage<Transfer[]>(STORAGE_KEY, []);

  // Filter to transfers within the period's date range
  const transfers = useMemo(() => {
    if (!period) return [];
    return allTransfers.filter((t) => t.date >= period.startDate && t.date <= period.endDate);
  }, [allTransfers, period]);

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
    transfers,
    addTransfer,
    updateTransfer,
    deleteTransfer,
  };
}
