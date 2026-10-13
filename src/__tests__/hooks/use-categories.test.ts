import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCategories } from '@/hooks/use-categories';
import type { BudgetRule, Category, Transaction } from '@/lib/types';

// The test environment has no IndexedDB, so each table is stood in for by an
// array with the handful of Dexie methods the hook calls. As in the real
// schema, budgetRules has no categoryId index, so it offers filter() and no
// where().
const {
  storedCategories,
  storedTransactions,
  storedBudgetRules,
  categoriesTable,
  transactionsTable,
  budgetRulesTable,
  runTransaction,
} = vi.hoisted(() => {
  const storedCategories: Category[] = [];
  const storedTransactions: Transaction[] = [];
  const storedBudgetRules: BudgetRule[] = [];
  const transactionsTable = {
    where: vi.fn((field: 'categoryId') => ({
      equals: (value: string) => ({
        modify: async (updates: Partial<Transaction>) => {
          storedTransactions
            .filter((transaction) => transaction[field] === value)
            .forEach((transaction) => Object.assign(transaction, updates));
        },
      }),
    })),
  };
  const budgetRulesTable = {
    filter: vi.fn((isMatch: (rule: BudgetRule) => boolean) => ({
      delete: async () => {
        const rulesToKeep = storedBudgetRules.filter((rule) => !isMatch(rule));
        storedBudgetRules.length = 0;
        storedBudgetRules.push(...rulesToKeep);
      },
    })),
  };
  const runTransaction = vi.fn(
    async (_mode: string, _tables: unknown[], writes: () => Promise<void>) => writes(),
  );
  const categoriesTable = {
    delete: vi.fn(async (id: string) => {
      const index = storedCategories.findIndex((category) => category.id === id);
      if (index !== -1) storedCategories.splice(index, 1);
    }),
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
  return {
    storedCategories,
    storedTransactions,
    storedBudgetRules,
    categoriesTable,
    transactionsTable,
    budgetRulesTable,
    runTransaction,
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    categories: categoriesTable,
    transactions: transactionsTable,
    budgetRules: budgetRulesTable,
    transaction: runTransaction,
  },
}));
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

function buildExpense(id: string, categoryId: string): Transaction {
  return {
    id,
    userId: 'local',
    createdAt: '2026-10-12T00:00:00.000Z',
    updatedAt: '2026-10-12T00:00:00.000Z',
    type: 'expense',
    date: '2026-10-12',
    amountCents: 1500,
    description: 'Shop',
    categoryId,
    savingsGoalId: null,
  };
}

function buildBudgetRule(id: string, categoryId: string): BudgetRule {
  return {
    id,
    userId: 'local',
    createdAt: '2026-10-12T00:00:00.000Z',
    updatedAt: '2026-10-12T00:00:00.000Z',
    scenarioId: 'main',
    categoryId,
    amountCents: 20000,
    cadence: 'monthly',
  };
}

function nameOf(id: string): string | undefined {
  return storedCategories.find((category) => category.id === id)?.name;
}

beforeEach(() => {
  storedCategories.length = 0;
  storedTransactions.length = 0;
  storedBudgetRules.length = 0;
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

  describe('deleteCategory', () => {
    it('deletes a category that nothing points at', async () => {
      storedCategories.push(buildCategory('food', 'Food'), buildCategory('transport', 'Transport'));
      const { result } = renderHook(() => useCategories());

      await result.current.deleteCategory('food');

      expect(storedCategories.map((category) => category.id)).toEqual(['transport']);
    });

    it('deletes the allowances of that category and leaves the others', async () => {
      storedCategories.push(buildCategory('food', 'Food'), buildCategory('transport', 'Transport'));
      storedBudgetRules.push(
        buildBudgetRule('food-allowance', 'food'),
        buildBudgetRule('transport-allowance', 'transport'),
      );
      const { result } = renderHook(() => useCategories());

      await result.current.deleteCategory('food');

      expect(storedBudgetRules.map((rule) => rule.id)).toEqual(['transport-allowance']);
    });

    it('uncategorises the transactions of that category and leaves the others', async () => {
      storedCategories.push(buildCategory('food', 'Food'), buildCategory('transport', 'Transport'));
      storedTransactions.push(buildExpense('lunch', 'food'), buildExpense('bus-fare', 'transport'));
      const { result } = renderHook(() => useCategories());

      await result.current.deleteCategory('food');

      expect(storedTransactions.map((transaction) => transaction.categoryId)).toEqual([
        null,
        'transport',
      ]);
    });

    it('makes its writes inside one transaction over all three tables', async () => {
      storedCategories.push(buildCategory('food', 'Food'));
      const { result } = renderHook(() => useCategories());

      await result.current.deleteCategory('food');

      expect(runTransaction).toHaveBeenCalledTimes(1);
      expect(runTransaction).toHaveBeenCalledWith(
        'rw',
        [transactionsTable, budgetRulesTable, categoriesTable],
        expect.any(Function),
      );
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
