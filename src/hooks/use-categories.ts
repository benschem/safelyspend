import { useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { Category, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:categories';
const USER_ID = 'local';

export function useCategories() {
  const [categories, setCategories] = useLocalStorage<Category[]>(STORAGE_KEY, []);

  const addCategory = useCallback(
    (data: CreateEntity<Category>) => {
      const timestamp = now();
      const newCategory: Category = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      setCategories((prev) => [...prev, newCategory]);
      return newCategory;
    },
    [setCategories],
  );

  const updateCategory = useCallback(
    (id: string, updates: Partial<Omit<Category, 'id' | 'userId' | 'createdAt'>>) => {
      setCategories((prev) =>
        prev.map((category) =>
          category.id === id ? { ...category, ...updates, updatedAt: now() } : category,
        ),
      );
    },
    [setCategories],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      setCategories((prev) => prev.filter((category) => category.id !== id));
    },
    [setCategories],
  );

  const activeCategories = categories.filter((c) => !c.isArchived);
  const archivedCategories = categories.filter((c) => c.isArchived);

  return {
    categories,
    activeCategories,
    archivedCategories,
    addCategory,
    updateCategory,
    deleteCategory,
  };
}
