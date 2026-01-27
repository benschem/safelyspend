import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { Transaction, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:transactions';
const USER_ID = 'local';

/**
 * Hook for managing transactions
 * Transactions are global facts - filtering is done by date range
 */
export function useTransactions(startDate?: string, endDate?: string) {
  const [allTransactions, setTransactions] = useLocalStorage<Transaction[]>(STORAGE_KEY, []);

  // Filter to transactions within the date range
  const transactions = useMemo(() => {
    if (!startDate || !endDate) return allTransactions;
    return allTransactions.filter((t) => t.date >= startDate && t.date <= endDate);
  }, [allTransactions, startDate, endDate]);

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

  // Get transactions up to a specific date (for balance calculations)
  const getTransactionsUpTo = useCallback(
    (date: string) => {
      return allTransactions.filter((t) => t.date <= date);
    },
    [allTransactions],
  );

  // Get transactions for a specific account up to a date
  const getAccountTransactionsUpTo = useCallback(
    (accountId: string, date: string) => {
      return allTransactions.filter((t) => t.accountId === accountId && t.date <= date);
    },
    [allTransactions],
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
    allTransactions,
    transactions,
    incomeTransactions,
    expenseTransactions,
    savingsTransactions,
    getTransactionsUpTo,
    getAccountTransactionsUpTo,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
