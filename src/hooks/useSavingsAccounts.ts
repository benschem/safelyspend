import useLocalStorage from "./useLocalStorage";
import type { SavingsAccount } from "../types";

export default function useSavingsAccounts() {
  const [savingsAccounts, setSavingsAccounts] = useLocalStorage<SavingsAccount[]>(
    "savingsAccounts",
    [],
  );

  const addSavingsAccount = (
    name: string,
    startingAmount: number,
    startingDate: string,
    goal: number,
  ) => {
    setSavingsAccounts((prev: SavingsAccount[]) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name,
        startingAmount,
        startingDate,
        goal,
      },
    ]);
  };

  const updateSavingsAccount = (id: string, updates: Partial<SavingsAccount>) => {
    setSavingsAccounts(prev =>
      prev.map(account => (account.id === id ? { ...account, ...updates } : account)),
    );
  };

  const deleteSavingsAccount = (id: string) => {
    setSavingsAccounts(prev => prev.filter(account => account.id !== id));
  };

  return { savingsAccounts, setSavingsAccounts, addSavingsAccount, updateSavingsAccount, deleteSavingsAccount };
}
