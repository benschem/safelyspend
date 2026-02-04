import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { BudgetRule, CreateEntity, Cadence } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const USER_ID = 'local';

/**
 * Calculate how many occurrences of a cadence fall within a date range
 */
function countOccurrences(cadence: Cadence, startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  switch (cadence) {
    case 'weekly':
      return Math.ceil(diffDays / 7);
    case 'fortnightly':
      return Math.ceil(diffDays / 14);
    case 'monthly': {
      const startYear = start.getFullYear();
      const startMonth = start.getMonth();
      const endYear = end.getFullYear();
      const endMonth = end.getMonth();
      return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
    }
    case 'quarterly': {
      const startYear = start.getFullYear();
      const startQuarter = Math.floor(start.getMonth() / 3);
      const endYear = end.getFullYear();
      const endQuarter = Math.floor(end.getMonth() / 3);
      return (endYear - startYear) * 4 + (endQuarter - startQuarter) + 1;
    }
    case 'yearly': {
      return end.getFullYear() - start.getFullYear() + 1;
    }
  }
}

/**
 * Expand a budget rule over a date range to get the total budget amount
 */
function expandBudgetRule(rule: BudgetRule, rangeStart: string, rangeEnd: string): number {
  // Determine effective start/end for the rule
  const effectiveStart =
    rule.startDate && rule.startDate > rangeStart ? rule.startDate : rangeStart;
  const effectiveEnd = rule.endDate && rule.endDate < rangeEnd ? rule.endDate : rangeEnd;

  if (effectiveStart > effectiveEnd) return 0;

  const occurrences = countOccurrences(rule.cadence, effectiveStart, effectiveEnd);
  return rule.amountCents * occurrences;
}

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

      const rule = budgetRules.find((br) => br.categoryId === categoryId);
      if (!rule) return 0;

      return expandBudgetRule(rule, startDate, endDate);
    },
    [budgetRules, startDate, endDate],
  );

  // Get the rule for a category (for display/editing)
  const getRuleForCategory = useCallback(
    (categoryId: string) => {
      return budgetRules.find((br) => br.categoryId === categoryId) ?? null;
    },
    [budgetRules],
  );

  // Get all expanded budgets by category
  const expandedBudgets = useMemo(() => {
    if (!startDate || !endDate) return {};

    const result: Record<string, number> = {};
    for (const rule of budgetRules) {
      result[rule.categoryId] = expandBudgetRule(rule, startDate, endDate);
    }
    return result;
  }, [budgetRules, startDate, endDate]);

  // Add or update a budget rule for a category
  const setBudgetForCategory = useCallback(
    async (
      categoryId: string,
      amountCents: number,
      cadence: Cadence = 'monthly',
      dayOfWeek?: number,
      dayOfMonth?: number,
      monthOfQuarter?: number,
      monthOfYear?: number,
    ) => {
      if (!scenarioId) return;

      const existing = allBudgetRules.find(
        (br) => br.scenarioId === scenarioId && br.categoryId === categoryId,
      );

      if (existing) {
        // Update existing
        const updates: Partial<BudgetRule> = {
          amountCents,
          cadence,
          updatedAt: now(),
        };
        if (dayOfWeek !== undefined) updates.dayOfWeek = dayOfWeek;
        if (dayOfMonth !== undefined) updates.dayOfMonth = dayOfMonth;
        if (monthOfQuarter !== undefined) updates.monthOfQuarter = monthOfQuarter;
        if (monthOfYear !== undefined) updates.monthOfYear = monthOfYear;
        await db.budgetRules.update(existing.id, updates);
      } else {
        // Create new
        const timestamp = now();
        const newBudgetRule: BudgetRule = {
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          scenarioId,
          categoryId,
          amountCents,
          cadence,
        };
        if (dayOfWeek !== undefined) newBudgetRule.dayOfWeek = dayOfWeek;
        if (dayOfMonth !== undefined) newBudgetRule.dayOfMonth = dayOfMonth;
        if (monthOfQuarter !== undefined) newBudgetRule.monthOfQuarter = monthOfQuarter;
        if (monthOfYear !== undefined) newBudgetRule.monthOfYear = monthOfYear;
        await db.budgetRules.add(newBudgetRule);
      }
    },
    [allBudgetRules, scenarioId],
  );

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

  const updateBudgetRule = useCallback(
    async (id: string, updates: Partial<Omit<BudgetRule, 'id' | 'userId' | 'createdAt'>>) => {
      await db.budgetRules.update(id, { ...updates, updatedAt: now() });
    },
    [],
  );

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
    getRuleForCategory,
    setBudgetForCategory,
    addBudgetRule,
    updateBudgetRule,
    deleteBudgetRule,
    restoreBudgetRule,
    duplicateToScenario,
  };
}
