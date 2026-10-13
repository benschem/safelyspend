import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useScenarios } from '@/hooks/use-scenarios';
import { allowanceMatchKey } from '@/lib/allowances';
import type { BudgetRule } from '@/lib/types';
import { toMonthlyCents, type CadenceType } from '@/lib/utils';

/**
 * Hook that provides comparison between active scenario values and default scenario values.
 * Returns functions to check if specific values differ from the default.
 */
export function useScenarioDiff() {
  const { activeScenarioId, scenarios } = useScenarios();

  // Find the default scenario
  const defaultScenario = useMemo(() => scenarios.find((s) => s.isDefault), [scenarios]);

  const isViewingDefault = defaultScenario?.id === activeScenarioId;

  // Load default scenario's budget rules
  const defaultBudgetRules = useLiveQuery(
    () =>
      defaultScenario
        ? db.budgetRules.where('scenarioId').equals(defaultScenario.id).toArray()
        : [],
    [defaultScenario?.id],
  );

  // Load default scenario's forecast rules
  const defaultForecastRules = useLiveQuery(
    () =>
      defaultScenario
        ? db.forecastRules.where('scenarioId').equals(defaultScenario.id).toArray()
        : [],
    [defaultScenario?.id],
  );

  // Build lookup maps for default values. An allowance is matched across
  // scenarios by its category and name, because rules have different IDs.
  // Each key holds a list: converted or synced data can have two allowances
  // of one name in a category, and neither should hide the other.
  const defaultAllowanceAmountsByMatchKey = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const rule of defaultBudgetRules ?? []) {
      const matchKey = allowanceMatchKey(rule);
      map[matchKey] = [...(map[matchKey] ?? []), rule.amountCents];
    }
    return map;
  }, [defaultBudgetRules]);

  // Monthly budget per category (for comparison in UI): the total of the
  // category's allowances, as the category limits are.
  const defaultBudgetByCategoryMonthly = useMemo(() => {
    const map: Record<string, number> = {};
    for (const rule of defaultBudgetRules ?? []) {
      map[rule.categoryId] =
        (map[rule.categoryId] ?? 0) + toMonthlyCents(rule.amountCents, rule.cadence as CadenceType);
    }
    return map;
  }, [defaultBudgetRules]);

  // Map by description for matching across scenarios (rules have different IDs)
  const defaultIncomeByDescription = useMemo(() => {
    const map: Record<string, number> = {};
    for (const rule of defaultForecastRules ?? []) {
      if (rule.type === 'income') {
        map[rule.description] = rule.amountCents;
      }
    }
    return map;
  }, [defaultForecastRules]);

  const defaultExpenseByDescription = useMemo(() => {
    const map: Record<string, number> = {};
    for (const rule of defaultForecastRules ?? []) {
      if (rule.type === 'expense') {
        map[rule.description] = rule.amountCents;
      }
    }
    return map;
  }, [defaultForecastRules]);

  const defaultSavingsByDescription = useMemo(() => {
    const map: Record<string, number> = {};
    for (const rule of defaultForecastRules ?? []) {
      if (rule.type === 'savings') {
        map[rule.description] = rule.amountCents;
      }
    }
    return map;
  }, [defaultForecastRules]);

  /**
   * Calculate monthly totals from default scenario rules.
   * These are the "Current Plan" values for comparison.
   */
  const defaultTotals = useMemo(() => {
    // Calculate monthly income
    let income = 0;
    for (const rule of defaultForecastRules ?? []) {
      if (rule.type === 'income') {
        income += toMonthlyCents(rule.amountCents, rule.cadence as CadenceType);
      }
    }

    // Calculate monthly fixed expenses (from forecast rules)
    let fixedExpenses = 0;
    for (const rule of defaultForecastRules ?? []) {
      if (rule.type === 'expense') {
        fixedExpenses += toMonthlyCents(rule.amountCents, rule.cadence as CadenceType);
      }
    }

    // Calculate monthly budgeted expenses (from budget rules)
    let budgetedExpenses = 0;
    for (const rule of defaultBudgetRules ?? []) {
      budgetedExpenses += toMonthlyCents(rule.amountCents, rule.cadence as CadenceType);
    }

    // Calculate monthly savings
    let savings = 0;
    for (const rule of defaultForecastRules ?? []) {
      if (rule.type === 'savings') {
        savings += toMonthlyCents(rule.amountCents, rule.cadence as CadenceType);
      }
    }

    // Surplus = income - all expenses - savings
    const surplus = income - fixedExpenses - budgetedExpenses - savings;

    return {
      income,
      fixedExpenses,
      budgetedExpenses,
      savings,
      surplus,
    };
  }, [defaultForecastRules, defaultBudgetRules]);

  /**
   * Get delta for a total (current - default).
   * Returns 0 if viewing default scenario.
   */
  const getTotalDelta = (
    type: 'income' | 'fixed' | 'budget' | 'savings' | 'surplus',
    currentValue: number,
  ): number => {
    if (isViewingDefault) return 0;

    switch (type) {
      case 'income':
        return currentValue - defaultTotals.income;
      case 'fixed':
        return currentValue - defaultTotals.fixedExpenses;
      case 'budget':
        return currentValue - defaultTotals.budgetedExpenses;
      case 'savings':
        return currentValue - defaultTotals.savings;
      case 'surplus':
        return currentValue - defaultTotals.surplus;
    }
  };

  /**
   * What the default scenario gives the allowance of the same category and
   * name. Undefined when it has no such allowance.
   *
   * When the default scenario has several of that name, the one with the
   * current amount is the match, so an unchanged copy does not read as
   * changed. If none has that amount, the first is used.
   */
  const getDefaultAllowanceAmount = (
    allowance: Pick<BudgetRule, 'categoryId' | 'name'>,
    currentAmount: number,
  ): number | undefined => {
    const defaultAmounts = defaultAllowanceAmountsByMatchKey[allowanceMatchKey(allowance)];
    if (!defaultAmounts) return undefined;
    return defaultAmounts.includes(currentAmount) ? currentAmount : defaultAmounts[0];
  };

  /**
   * Check if an allowance's amount differs from the default scenario.
   * Returns true if viewing non-default scenario AND value differs.
   */
  const isBudgetDifferent = (
    allowance: Pick<BudgetRule, 'categoryId' | 'name'>,
    currentAmount: number,
  ): boolean => {
    if (isViewingDefault) return false;
    const defaultAmount = getDefaultAllowanceAmount(allowance, currentAmount);
    // If no default exists, it's different (new allowance in this scenario)
    if (defaultAmount === undefined) return true;
    return currentAmount !== defaultAmount;
  };

  /**
   * Check if an income forecast differs from default (by description match).
   */
  const isIncomeDifferent = (description: string, currentAmount: number): boolean => {
    if (isViewingDefault) return false;
    const defaultAmount = defaultIncomeByDescription[description];
    if (defaultAmount === undefined) return true;
    return currentAmount !== defaultAmount;
  };

  /**
   * Check if a fixed expense forecast differs from default (by description match).
   */
  const isExpenseDifferent = (description: string, currentAmount: number): boolean => {
    if (isViewingDefault) return false;
    const defaultAmount = defaultExpenseByDescription[description];
    if (defaultAmount === undefined) return true;
    return currentAmount !== defaultAmount;
  };

  /**
   * Check if a savings forecast differs from default (by description match).
   */
  const isSavingsDifferent = (description: string, currentAmount: number): boolean => {
    if (isViewingDefault) return false;
    const defaultAmount = defaultSavingsByDescription[description];
    if (defaultAmount === undefined) return true;
    return currentAmount !== defaultAmount;
  };

  return {
    isViewingDefault,
    defaultScenarioName: defaultScenario?.name ?? 'Default',
    isBudgetDifferent,
    isIncomeDifferent,
    isExpenseDifferent,
    isSavingsDifferent,
    // Raw default values for direct comparison if needed
    getDefaultAllowanceAmount,
    defaultIncomeByDescription,
    defaultExpenseByDescription,
    defaultSavingsByDescription,
    // Monthly default budgets per category for UI comparison
    defaultBudgetByCategoryMonthly,
    // Totals from default scenario (monthly)
    defaultTotals,
    // Get delta for a total (current - default)
    getTotalDelta,
  };
}
