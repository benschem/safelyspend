import { useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { Account, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:accounts';
const USER_ID = 'local';

export function useAccounts() {
  const [accounts, setAccounts] = useLocalStorage<Account[]>(STORAGE_KEY, []);

  const addAccount = useCallback(
    (data: CreateEntity<Account>) => {
      const timestamp = now();
      const newAccount: Account = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      setAccounts((prev) => [...prev, newAccount]);
      return newAccount;
    },
    [setAccounts],
  );

  const updateAccount = useCallback(
    (id: string, updates: Partial<Omit<Account, 'id' | 'userId' | 'createdAt'>>) => {
      setAccounts((prev) =>
        prev.map((account) =>
          account.id === id ? { ...account, ...updates, updatedAt: now() } : account,
        ),
      );
    },
    [setAccounts],
  );

  const deleteAccount = useCallback(
    (id: string) => {
      setAccounts((prev) => prev.filter((account) => account.id !== id));
    },
    [setAccounts],
  );

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const archivedAccounts = accounts.filter((a) => a.isArchived);

  return {
    accounts,
    activeAccounts,
    archivedAccounts,
    addAccount,
    updateAccount,
    deleteAccount,
  };
}
