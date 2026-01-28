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

  // Get existing category by name or create a new one
  const getOrCreate = useCallback(
    (name: string): string | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;

      // Check if exists (case-insensitive)
      const existing = categories.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase() && !c.isArchived,
      );
      if (existing) return existing.id;

      // Create new category
      const newCategory = addCategory({ name: trimmed, isArchived: false });
      return newCategory.id;
    },
    [categories, addCategory],
  );

  // Bulk get or create for import (returns map of input name -> category id)
  const bulkGetOrCreate = useCallback(
    (names: string[]): Map<string, string> => {
      const result = new Map<string, string>();
      const newCategories: Array<{ name: string }> = [];
      const nameToPendingId = new Map<string, string>();

      for (const name of names) {
        const trimmed = name.trim();
        if (!trimmed) continue;

        const lowerName = trimmed.toLowerCase();

        // Check existing categories
        const existing = categories.find(
          (c) => c.name.toLowerCase() === lowerName && !c.isArchived,
        );
        if (existing) {
          result.set(trimmed, existing.id);
          continue;
        }

        // Check if we're already adding it in this batch
        if (nameToPendingId.has(lowerName)) {
          result.set(trimmed, nameToPendingId.get(lowerName)!);
          continue;
        }

        // Queue for creation
        const id = generateId();
        nameToPendingId.set(lowerName, id);
        newCategories.push({ name: trimmed });
        result.set(trimmed, id);
      }

      // Create all new categories at once
      if (newCategories.length > 0) {
        const timestamp = now();
        const categoriesToAdd = newCategories.map((data) => ({
          id: result.get(data.name)!,
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          name: data.name,
          isArchived: false,
        }));
        setCategories((prev) => [...prev, ...categoriesToAdd]);
      }

      return result;
    },
    [categories, setCategories],
  );

  return {
    categories,
    activeCategories,
    archivedCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    getOrCreate,
    bulkGetOrCreate,
  };
}
