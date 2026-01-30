import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Transaction, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const USER_ID = 'local';

/**
 * Hook for managing transactions
 * Transactions are global facts - filtering is done by date range using indexed queries
 * Supports partial date ranges (from-only or to-only)
 */
export function useTransactions(startDate?: string, endDate?: string) {
  // Use indexed date query for transactions in range (supports partial ranges)
  const rawTransactions = useLiveQuery(
    () => {
      if (startDate && endDate) {
        // Both dates: range query
        return db.transactions.where('date').between(startDate, endDate, true, true).toArray();
      }
      if (startDate) {
        // From date only: all from this date onwards
        return db.transactions.where('date').aboveOrEqual(startDate).toArray();
      }
      if (endDate) {
        // To date only: all up to this date
        return db.transactions.where('date').belowOrEqual(endDate).toArray();
      }
      // No dates: return all
      return db.transactions.toArray();
    },
    [startDate, endDate],
  );
  const transactions = useMemo(() => rawTransactions ?? [], [rawTransactions]);

  // For allTransactions, we need all of them (used for balance calculations, fingerprints, etc.)
  const rawAllTransactions = useLiveQuery(() => db.transactions.toArray(), []);
  const allTransactions = useMemo(() => rawAllTransactions ?? [], [rawAllTransactions]);

  const isLoading = rawTransactions === undefined || rawAllTransactions === undefined;

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
  const adjustmentTransactions = useMemo(
    () => allTransactions.filter((t) => t.type === 'adjustment'),
    [allTransactions],
  );

  // Get transactions up to a specific date (for balance calculations)
  const getTransactionsUpTo = useCallback(
    async (date: string) => {
      return db.transactions.where('date').belowOrEqual(date).toArray();
    },
    [],
  );

  const addTransaction = useCallback(async (data: CreateEntity<Transaction>) => {
    const timestamp = now();
    const newTransaction: Transaction = {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...data,
    };
    await db.transactions.add(newTransaction);
    return newTransaction;
  }, []);

  const updateTransaction = useCallback(
    async (id: string, updates: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>) => {
      await db.transactions.update(id, { ...updates, updatedAt: now() });
    },
    [],
  );

  const deleteTransaction = useCallback(async (id: string) => {
    await db.transactions.delete(id);
  }, []);

  // Get set of fingerprints for existing transactions (for duplicate detection during import)
  const getExistingFingerprints = useCallback(async (): Promise<Set<string>> => {
    const fingerprints = new Set<string>();
    // Use indexed query for fingerprints that exist
    const transactionsWithFingerprints = await db.transactions
      .where('importFingerprint')
      .notEqual('')
      .toArray();
    for (const t of transactionsWithFingerprints) {
      if (t.importFingerprint) {
        fingerprints.add(t.importFingerprint);
      }
    }
    return fingerprints;
  }, []);

  // Bulk import transactions (for CSV import)
  const bulkImport = useCallback(
    async (transactionsData: Array<CreateEntity<Transaction>>): Promise<Transaction[]> => {
      const timestamp = now();
      const newTransactions: Transaction[] = transactionsData.map((data) => ({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      }));

      await db.transactions.bulkAdd(newTransactions);
      return newTransactions;
    },
    [],
  );

  return {
    allTransactions,
    transactions,
    incomeTransactions,
    expenseTransactions,
    savingsTransactions,
    adjustmentTransactions,
    isLoading,
    getTransactionsUpTo,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getExistingFingerprints,
    bulkImport,
  };
}
