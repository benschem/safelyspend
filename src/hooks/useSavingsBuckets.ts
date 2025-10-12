import useLocalStorage from "./useLocalStorage";
import type { SavingsBucket } from "../types";

export default function useSavingsBuckets() {
  const [savingsBuckets, setSavingsBuckets] = useLocalStorage<SavingsBucket[]>(
    "savingsBuckets",
    [],
  );

  const addSavingsBucket = (
    name: string,
    amount: number,
    goal: number,
  ) => {
    setSavingsBuckets((prev: SavingsBucket[]) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name,
        amount,
        goal,
      },
    ]);
  };

  const updateSavingsBucket = (id: string, updates: Partial<SavingsBucket>) => {
    setSavingsBuckets(prev =>
      prev.map(bucket => (bucket.id === id ? { ...bucket, ...updates } : bucket)),
    );
  };

  const deleteSavingsBucket = (id: string) => {
    setSavingsBuckets(prev => prev.filter(bucket => bucket.id !== id));
  };

  return { savingsBuckets, setSavingsBuckets, addSavingsBucket, updateSavingsBucket, deleteSavingsBucket };
}
