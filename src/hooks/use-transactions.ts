import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { Transaction, CreateEntity, Period } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:transactions';
const USER_ID = 'local';

export function useTransactions(period: Period | null) {
  const [allTransactions, setTransactions] = useLocalStorage<Transaction[]>(STORAGE_KEY, []);

  // Filter to transactions within the period's date range
  const transactions = useMemo(() => {
    if (!period) return [];
    return allTransactions.filter((t) => t.date >= period.startDate && t.date <= period.endDate);
  }, [allTransactions, period]);

  const incomeTransactions = useMemo(
    () => transactions.filter((t) => t.type === 'income'),
    [transactions],
  );
  const expenseTransactions = useMemo(
    () => transactions.filter((t) => t.type === 'expense'),
    [transactions],
  );
  const savingsTransactions = useMemo(
    () => transactions.filter((t) => t.type === 'savings'),
    [transactions],
  );

  const addTransaction = useCallback(
    (data: CreateEntity<Transaction>) => {
      const timestamp = now();
      const newTransaction: Transaction = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      setTransactions((prev) => [...prev, newTransaction]);
      return newTransaction;
    },
    [setTransactions],
  );

  const updateTransaction = useCallback(
    (id: string, updates: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>) => {
      setTransactions((prev) =>
        prev.map((transaction) =>
          transaction.id === id ? { ...transaction, ...updates, updatedAt: now() } : transaction,
        ),
      );
    },
    [setTransactions],
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      setTransactions((prev) => prev.filter((transaction) => transaction.id !== id));
    },
    [setTransactions],
  );

  return {
    transactions,
    incomeTransactions,
    expenseTransactions,
    savingsTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
