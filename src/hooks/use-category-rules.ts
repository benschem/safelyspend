import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { CategoryRule, CreateEntity, Transaction } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const USER_ID = 'local';

export function useCategoryRules() {
  const rules = useLiveQuery(() => db.categoryRules.toArray(), []) ?? [];

  const isLoading = rules === undefined;

  // Sort rules by priority (lower = higher priority)
  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => a.priority - b.priority),
    [rules],
  );

  const enabledRules = useMemo(
    () => sortedRules.filter((r) => r.enabled),
    [sortedRules],
  );

  // Check if a transaction matches a rule
  const matchesRule = useCallback(
    (transaction: Pick<Transaction, 'description' | 'amountCents' | 'type'>, rule: CategoryRule): boolean => {
      // Check transaction type constraint
      if (rule.transactionType && transaction.type !== rule.transactionType) {
        return false;
      }

      // Check amount constraints
      if (rule.amountMinCents !== undefined && transaction.amountCents < rule.amountMinCents) {
        return false;
      }
      if (rule.amountMaxCents !== undefined && transaction.amountCents > rule.amountMaxCents) {
        return false;
      }

      // Get the field to match against (for now, always description since CSV doesn't have separate payee)
      const fieldValue = transaction.description.toLowerCase();
      const matchValue = rule.matchValue.toLowerCase();

      switch (rule.matchType) {
        case 'contains':
          return fieldValue.includes(matchValue);
        case 'startsWith':
          return fieldValue.startsWith(matchValue);
        case 'equals':
          return fieldValue === matchValue;
        default:
          return false;
      }
    },
    [],
  );

  // Apply rules to a transaction, return the category ID if a rule matches
  const applyRules = useCallback(
    (transaction: Pick<Transaction, 'description' | 'amountCents' | 'type'>): string | null => {
      for (const rule of enabledRules) {
        if (matchesRule(transaction, rule)) {
          return rule.categoryId;
        }
      }
      return null;
    },
    [enabledRules, matchesRule],
  );

  // Apply rules to multiple transactions, returns a map of transaction index to category ID
  const applyRulesToBatch = useCallback(
    (transactions: Array<Pick<Transaction, 'description' | 'amountCents' | 'type'>>): Map<number, string> => {
      const result = new Map<number, string>();
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        if (!tx) continue;
        const categoryId = applyRules(tx);
        if (categoryId) {
          result.set(i, categoryId);
        }
      }
      return result;
    },
    [applyRules],
  );

  const addRule = useCallback(async (data: CreateEntity<CategoryRule>) => {
    const timestamp = now();
    const newRule: CategoryRule = {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...data,
    };
    await db.categoryRules.add(newRule);
    return newRule;
  }, []);

  const updateRule = useCallback(
    async (id: string, updates: Partial<Omit<CategoryRule, 'id' | 'userId' | 'createdAt'>>) => {
      await db.categoryRules.update(id, { ...updates, updatedAt: now() });
    },
    [],
  );

  const deleteRule = useCallback(async (id: string) => {
    await db.categoryRules.delete(id);
  }, []);

  // Reorder rules (set new priorities)
  const reorderRules = useCallback(async (orderedIds: string[]) => {
    const timestamp = now();
    const updates = orderedIds.map((id, index) => ({
      key: id,
      changes: { priority: index, updatedAt: timestamp },
    }));

    await db.transaction('rw', db.categoryRules, async () => {
      for (const update of updates) {
        await db.categoryRules.update(update.key, update.changes);
      }
    });
  }, []);

  // Get the next available priority number
  const getNextPriority = useCallback(() => {
    if (rules.length === 0) return 0;
    return Math.max(...rules.map((r) => r.priority)) + 1;
  }, [rules]);

  return {
    rules: sortedRules,
    enabledRules,
    isLoading,
    applyRules,
    applyRulesToBatch,
    matchesRule,
    addRule,
    updateRule,
    deleteRule,
    reorderRules,
    getNextPriority,
  };
}
