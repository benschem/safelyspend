import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { allowancesForCategory, expandBudgetsByCategory } from '@/lib/allowances';
import type { BudgetRule, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const USER_ID = 'local';

const OPTIONAL_BUDGET_RULE_FIELDS = ['name', 'startDate', 'endDate'] as const;
type OptionalBudgetRuleField = (typeof OPTIONAL_BUDGET_RULE_FIELDS)[number];

/**
 * The changes `updateBudgetRule` takes. An optional field given as undefined
 * is taken off the rule, which is how an allowance loses its name and goes
 * back to being the category's general spending.
 */
export type BudgetRuleUpdates = Partial<
  Omit<BudgetRule, 'id' | 'userId' | 'createdAt' | OptionalBudgetRuleField>
> & { [Field in OptionalBudgetRuleField]?: string | undefined };

/**
 * Hook for managing budget rules with cadence
 */
export function useBudgetRules(scenarioId: string | null, startDate?: string, endDate?: string) {
  const rawBudgetRules = useLiveQuery(() => db.budgetRules.toArray(), []);
  const allBudgetRules = useMemo(() => rawBudgetRules ?? [], [rawBudgetRules]);

  const isLoading = rawBudgetRules === undefined;

  // Filter to current scenario
  const budgetRules = useMemo(
    () => (scenarioId ? allBudgetRules.filter((br) => br.scenarioId === scenarioId) : []),
    [allBudgetRules, scenarioId],
  );

  // Get expanded budget amount for a category over the date range
  const getBudgetForCategory = useCallback(
    (categoryId: string) => {
      if (!startDate || !endDate) return 0;

      return expandBudgetsByCategory(budgetRules, startDate, endDate)[categoryId] ?? 0;
    },
    [budgetRules, startDate, endDate],
  );

  // Get every rule for a category (for display/editing)
  const getRulesForCategory = useCallback(
    (categoryId: string) => allowancesForCategory(budgetRules, categoryId),
    [budgetRules],
  );

  // Get all expanded budgets by category
  const expandedBudgets = useMemo(() => {
    if (!startDate || !endDate) return {};

    return expandBudgetsByCategory(budgetRules, startDate, endDate);
  }, [budgetRules, startDate, endDate]);

  const addBudgetRule = useCallback(async (data: CreateEntity<BudgetRule>) => {
    const timestamp = now();
    const newRule: BudgetRule = {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...data,
    };
    await db.budgetRules.add(newRule);
    return newRule;
  }, []);

  // Written with modify(), not update(): Dexie's update() type does not take
  // an explicit undefined under exactOptionalPropertyTypes, and an optional
  // field given as undefined has to come off the stored rule
  const updateBudgetRule = useCallback(async (id: string, updates: BudgetRuleUpdates) => {
    const timestamp = now();
    await db.budgetRules
      .where('id')
      .equals(id)
      .modify((storedRule) => {
        Object.assign(storedRule, updates, { updatedAt: timestamp });
        for (const field of OPTIONAL_BUDGET_RULE_FIELDS) {
          if (field in updates && updates[field] === undefined) delete storedRule[field];
        }
      });
  }, []);

  const deleteBudgetRule = useCallback(async (id: string) => {
    await db.budgetRules.delete(id);
  }, []);

  const restoreBudgetRule = useCallback(async (rule: BudgetRule) => {
    await db.budgetRules.put(rule);
    return rule;
  }, []);

  // Duplicate rules from one scenario to another
  const duplicateToScenario = useCallback(
    async (fromScenarioId: string, toScenarioId: string) => {
      const timestamp = now();

      const rulesToCopy = allBudgetRules.filter((r) => r.scenarioId === fromScenarioId);
      const newRules = rulesToCopy.map((rule) => ({
        ...rule,
        id: generateId(),
        scenarioId: toScenarioId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }));

      await db.budgetRules.bulkAdd(newRules);
    },
    [allBudgetRules],
  );

  return {
    budgetRules,
    expandedBudgets,
    isLoading,
    getBudgetForCategory,
    getRulesForCategory,
    addBudgetRule,
    updateBudgetRule,
    deleteBudgetRule,
    restoreBudgetRule,
    duplicateToScenario,
  };
}
