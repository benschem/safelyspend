import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { CategoryRule, CreateEntity, Transaction } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:categoryRules';
const USER_ID = 'local';

export function useCategoryRules() {
  const [rules, setRules] = useLocalStorage<CategoryRule[]>(STORAGE_KEY, []);

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

  const addRule = useCallback(
    (data: CreateEntity<CategoryRule>) => {
      const timestamp = now();
      const newRule: CategoryRule = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      setRules((prev) => [...prev, newRule]);
      return newRule;
    },
    [setRules],
  );

  const updateRule = useCallback(
    (id: string, updates: Partial<Omit<CategoryRule, 'id' | 'userId' | 'createdAt'>>) => {
      setRules((prev) =>
        prev.map((rule) =>
          rule.id === id ? { ...rule, ...updates, updatedAt: now() } : rule,
        ),
      );
    },
    [setRules],
  );

  const deleteRule = useCallback(
    (id: string) => {
      setRules((prev) => prev.filter((rule) => rule.id !== id));
    },
    [setRules],
  );

  // Reorder rules (set new priorities)
  const reorderRules = useCallback(
    (orderedIds: string[]) => {
      setRules((prev) =>
        prev.map((rule) => {
          const newPriority = orderedIds.indexOf(rule.id);
          if (newPriority === -1) return rule;
          return { ...rule, priority: newPriority, updatedAt: now() };
        }),
      );
    },
    [setRules],
  );

  // Get the next available priority number
  const getNextPriority = useCallback(() => {
    if (rules.length === 0) return 0;
    return Math.max(...rules.map((r) => r.priority)) + 1;
  }, [rules]);

  return {
    rules: sortedRules,
    enabledRules,
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
