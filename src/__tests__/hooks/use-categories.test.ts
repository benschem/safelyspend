import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCategories } from '@/hooks/use-categories';
import type { Category } from '@/lib/types';

// The test environment has no IndexedDB, so the categories table is stood in
// for by an array with the handful of Dexie methods the hook calls.
const { storedCategories, categoriesTable } = vi.hoisted(() => {
  const storedCategories: Category[] = [];
  const categoriesTable = {
    toArray: vi.fn(async () => [...storedCategories]),
    get: vi.fn(async (id: string) => storedCategories.find((category) => category.id === id)),
    add: vi.fn(async (category: Category) => {
      storedCategories.push(category);
    }),
    update: vi.fn(async (id: string, updates: Partial<Category>) => {
      const category = storedCategories.find((candidate) => candidate.id === id);
      if (category) Object.assign(category, updates);
    }),
  };
  return { storedCategories, categoriesTable };
});

vi.mock('@/lib/db', () => ({ db: { categories: categoriesTable } }));
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => [] }));

function buildCategory(id: string, name: string, isArchived = false): Category {
  return {
    id,
    userId: 'local',
    createdAt: '2026-10-12T00:00:00.000Z',
    updatedAt: '2026-10-12T00:00:00.000Z',
    name,
    isArchived,
  };
}

function nameOf(id: string): string | undefined {
  return storedCategories.find((category) => category.id === id)?.name;
}

beforeEach(() => {
  storedCategories.length = 0;
  vi.clearAllMocks();
});

describe('useCategories', () => {
  describe('updateCategory', () => {
    it('refuses a name another active category already has', async () => {
      storedCategories.push(buildCategory('food', 'Food'), buildCategory('groceries', 'Groceries'));
      const { result } = renderHook(() => useCategories());

      await expect(result.current.updateCategory('food', { name: 'Groceries' })).rejects.toThrow(
        'A category called "Groceries" already exists.',
      );
      expect(nameOf('food')).toBe('Food');
    });

    it('treats names that differ only by case or surrounding spaces as the same', async () => {
      storedCategories.push(buildCategory('food', 'Food'), buildCategory('groceries', 'Groceries'));
      const { result } = renderHook(() => useCategories());

      await expect(
        result.current.updateCategory('food', { name: '  groceries ' }),
      ).rejects.toThrow();
      expect(nameOf('food')).toBe('Food');
    });

    it('allows a name that only an archived category has', async () => {
      storedCategories.push(
        buildCategory('food', 'Food'),
        buildCategory('old-groceries', 'Groceries', true),
      );
      const { result } = renderHook(() => useCategories());

      await result.current.updateCategory('food', { name: 'Groceries' });

      expect(nameOf('food')).toBe('Groceries');
    });

    it('allows a category to change the case of its own name', async () => {
      storedCategories.push(buildCategory('food', 'food'));
      const { result } = renderHook(() => useCategories());

      await result.current.updateCategory('food', { name: 'Food' });

      expect(nameOf('food')).toBe('Food');
    });

    it('allows renaming an archived category to a name an active one has', async () => {
      storedCategories.push(
        buildCategory('old-food', 'Food', true),
        buildCategory('groceries', 'Groceries'),
      );
      const { result } = renderHook(() => useCategories());

      await result.current.updateCategory('old-food', { name: 'Groceries' });

      expect(nameOf('old-food')).toBe('Groceries');
    });

    it('does not check names when the update leaves the name alone', async () => {
      storedCategories.push(
        buildCategory('first', 'Groceries'),
        buildCategory('second', 'Groceries'),
      );
      const { result } = renderHook(() => useCategories());

      await result.current.updateCategory('first', { isArchived: true });

      expect(storedCategories[0]?.isArchived).toBe(true);
    });
  });

  describe('addCategory', () => {
    it('refuses a name an active category already has', async () => {
      storedCategories.push(buildCategory('groceries', 'Groceries'));
      const { result } = renderHook(() => useCategories());

      await expect(
        result.current.addCategory({ name: 'groceries', isArchived: false }),
      ).rejects.toThrow('A category called "Groceries" already exists.');
      expect(storedCategories).toHaveLength(1);
    });

    it('adds a category whose name is free', async () => {
      storedCategories.push(buildCategory('groceries', 'Groceries'));
      const { result } = renderHook(() => useCategories());

      const added = await result.current.addCategory({ name: 'Transport', isArchived: false });

      expect(nameOf(added.id)).toBe('Transport');
    });
  });
});
