import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Category, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const USER_ID = 'local';

/**
 * Refuse a name that another active category already has, ignoring case.
 * Archived categories do not count, matching getOrCreate. Reads the database
 * rather than hook state so the check cannot run against a stale list.
 */
async function assertNameIsFree(name: string, ownCategoryId: string | null): Promise<void> {
  const wantedName = name.trim().toLowerCase();
  const allCategories = await db.categories.toArray();
  const clash = allCategories.find(
    (category) =>
      category.id !== ownCategoryId &&
      !category.isArchived &&
      category.name.trim().toLowerCase() === wantedName,
  );
  if (clash) {
    throw new Error(`A category called "${clash.name}" already exists.`);
  }
}

export function useCategories() {
  const rawCategories = useLiveQuery(() => db.categories.toArray(), []);
  const categories = useMemo(() => rawCategories ?? [], [rawCategories]);

  const isLoading = rawCategories === undefined;

  const addCategory = useCallback(async (data: CreateEntity<Category>) => {
    if (!data.isArchived) {
      await assertNameIsFree(data.name, null);
    }
    const timestamp = now();
    const newCategory: Category = {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...data,
    };
    await db.categories.add(newCategory);
    return newCategory;
  }, []);

  const updateCategory = useCallback(
    async (id: string, updates: Partial<Omit<Category, 'id' | 'userId' | 'createdAt'>>) => {
      if (updates.name !== undefined) {
        const category = await db.categories.get(id);
        if (category && !category.isArchived) {
          await assertNameIsFree(updates.name, id);
        }
      }
      await db.categories.update(id, { ...updates, updatedAt: now() });
    },
    [],
  );

  const deleteCategory = useCallback(async (id: string) => {
    // One transaction, so a failure part way leaves nothing half done
    await db.transaction('rw', [db.transactions, db.budgetRules, db.categories], async () => {
      // Nullify categoryId on transactions that reference this category
      await db.transactions.where('categoryId').equals(id).modify({ categoryId: null });
      // Delete budget rules that reference this category. categoryId is not an
      // index on budgetRules, so this filters rather than using where()
      await db.budgetRules.filter((rule) => rule.categoryId === id).delete();
      // Delete the category
      await db.categories.delete(id);
    });
  }, []);

  const restoreCategory = useCallback(async (category: Category) => {
    await db.categories.put(category);
    return category;
  }, []);

  const activeCategories = useMemo(() => categories.filter((c) => !c.isArchived), [categories]);

  const archivedCategories = useMemo(() => categories.filter((c) => c.isArchived), [categories]);

  // Get existing category by name or create a new one
  const getOrCreate = useCallback(
    async (name: string): Promise<string | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;

      // Check if exists (case-insensitive)
      const existing = categories.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase() && !c.isArchived,
      );
      if (existing) return existing.id;

      // Create new category
      const newCategory = await addCategory({ name: trimmed, isArchived: false });
      return newCategory.id;
    },
    [categories, addCategory],
  );

  // Bulk get or create for import (returns map of input name -> category id)
  const bulkGetOrCreate = useCallback(
    async (names: string[]): Promise<Map<string, string>> => {
      const result = new Map<string, string>();
      const newCategories: Category[] = [];
      const nameToPendingId = new Map<string, string>();
      const timestamp = now();

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
        newCategories.push({
          id,
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          name: trimmed,
          isArchived: false,
        });
        result.set(trimmed, id);
      }

      // Create all new categories at once
      if (newCategories.length > 0) {
        await db.categories.bulkAdd(newCategories);
      }

      return result;
    },
    [categories],
  );

  return {
    categories,
    activeCategories,
    archivedCategories,
    isLoading,
    addCategory,
    updateCategory,
    deleteCategory,
    restoreCategory,
    getOrCreate,
    bulkGetOrCreate,
  };
}
