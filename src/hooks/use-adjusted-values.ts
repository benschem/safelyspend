import { useMemo } from 'react';
import { useBudgetRules } from './use-budget-rules';
import { useForecasts } from './use-forecasts';
import { useWhatIf } from '@/contexts/what-if-context';
import type { BudgetRule, ForecastRule, ExpandedForecast } from '@/lib/types';

/**
 * Returns budget rules with what-if adjustments applied
 */
export function useAdjustedBudgets(scenarioId: string | null, startDate?: string, endDate?: string) {
  const { budgetRules, expandedBudgets, isLoading, ...rest } = useBudgetRules(
    scenarioId,
    startDate,
    endDate,
  );
  const { adjustments } = useWhatIf();

  // Apply adjustments to budget rules
  const adjustedRules = useMemo((): BudgetRule[] => {
    return budgetRules.map((rule) => {
      const adjustment = adjustments.budgetAdjustments[rule.categoryId];
      if (adjustment !== undefined) {
        return { ...rule, amountCents: adjustment };
      }
      return rule;
    });
  }, [budgetRules, adjustments.budgetAdjustments]);

  // Recalculate expanded budgets with adjusted amounts
  const adjustedExpandedBudgets = useMemo((): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const [categoryId, amount] of Object.entries(expandedBudgets)) {
      const adjustment = adjustments.budgetAdjustments[categoryId];
      if (adjustment !== undefined) {
        // Simple ratio adjustment: if rule was adjusted by X%, expand by same ratio
        const rule = budgetRules.find((r) => r.categoryId === categoryId);
        if (rule && rule.amountCents > 0) {
          const ratio = adjustment / rule.amountCents;
          result[categoryId] = Math.round(amount * ratio);
        } else {
          result[categoryId] = adjustment;
        }
      } else {
        result[categoryId] = amount;
      }
    }
    return result;
  }, [expandedBudgets, adjustments.budgetAdjustments, budgetRules]);

  return {
    budgetRules: adjustedRules,
    expandedBudgets: adjustedExpandedBudgets,
    isLoading,
    ...rest,
  };
}

/**
 * Returns forecast rules and expanded forecasts with what-if adjustments applied
 */
export function useAdjustedForecasts(
  scenarioId: string | null,
  startDate?: string,
  endDate?: string,
) {
  const {
    rules,
    expandedForecasts,
    incomeForecasts,
    expenseForecasts,
    savingsForecasts,
    isLoading,
    ...rest
  } = useForecasts(scenarioId, startDate, endDate);
  const { adjustments } = useWhatIf();

  // Apply adjustments to forecast rules
  const adjustedRules = useMemo((): ForecastRule[] => {
    return rules.map((rule) => {
      let adjustment: number | undefined;

      if (rule.type === 'income') {
        adjustment = adjustments.incomeAdjustments[rule.id];
      } else if (rule.type === 'expense') {
        adjustment = adjustments.fixedExpenseAdjustments[rule.id];
      } else if (rule.type === 'savings') {
        adjustment = adjustments.savingsAdjustments[rule.id];
      }

      if (adjustment !== undefined) {
        return { ...rule, amountCents: adjustment };
      }
      return rule;
    });
  }, [rules, adjustments]);

  // Helper to adjust expanded forecasts
  const adjustForecasts = (
    forecasts: ExpandedForecast[],
    adjustmentMap: Record<string, number>,
    originalRules: ForecastRule[],
  ): ExpandedForecast[] => {
    return forecasts.map((forecast) => {
      if (forecast.sourceType !== 'rule') return forecast;

      const adjustment = adjustmentMap[forecast.sourceId];
      if (adjustment !== undefined) {
        // Find original rule to calculate ratio
        const originalRule = originalRules.find((r) => r.id === forecast.sourceId);
        if (originalRule && originalRule.amountCents > 0) {
          const ratio = adjustment / originalRule.amountCents;
          return { ...forecast, amountCents: Math.round(forecast.amountCents * ratio) };
        }
        return { ...forecast, amountCents: adjustment };
      }
      return forecast;
    });
  };

  // Adjust each type of forecast
  const adjustedIncomeForecasts = useMemo(
    () => adjustForecasts(incomeForecasts, adjustments.incomeAdjustments, rules),
    [incomeForecasts, adjustments.incomeAdjustments, rules],
  );

  const adjustedExpenseForecasts = useMemo(
    () => adjustForecasts(expenseForecasts, adjustments.fixedExpenseAdjustments, rules),
    [expenseForecasts, adjustments.fixedExpenseAdjustments, rules],
  );

  const adjustedSavingsForecasts = useMemo(
    () => adjustForecasts(savingsForecasts, adjustments.savingsAdjustments, rules),
    [savingsForecasts, adjustments.savingsAdjustments, rules],
  );

  // Combine all adjusted forecasts
  const adjustedExpandedForecasts = useMemo(() => {
    return [
      ...adjustedIncomeForecasts,
      ...adjustedExpenseForecasts,
      ...adjustedSavingsForecasts,
    ].sort((a, b) => a.date.localeCompare(b.date));
  }, [adjustedIncomeForecasts, adjustedExpenseForecasts, adjustedSavingsForecasts]);

  return {
    rules: adjustedRules,
    expandedForecasts: adjustedExpandedForecasts,
    incomeForecasts: adjustedIncomeForecasts,
    expenseForecasts: adjustedExpenseForecasts,
    savingsForecasts: adjustedSavingsForecasts,
    isLoading,
    ...rest,
  };
}

/**
 * Combined hook that returns all adjusted values for a scenario
 */
export function useAdjustedScenarioData(
  scenarioId: string | null,
  startDate?: string,
  endDate?: string,
) {
  const budgets = useAdjustedBudgets(scenarioId, startDate, endDate);
  const forecasts = useAdjustedForecasts(scenarioId, startDate, endDate);

  const isLoading = budgets.isLoading || forecasts.isLoading;

  // Calculate totals
  const totals = useMemo(() => {
    const totalIncome = forecasts.incomeForecasts.reduce((sum, f) => sum + f.amountCents, 0);
    const totalFixedExpenses = forecasts.expenseForecasts.reduce((sum, f) => sum + f.amountCents, 0);
    const totalBudgeted = Object.values(budgets.expandedBudgets).reduce((sum, v) => sum + v, 0);
    const totalSavings = forecasts.savingsForecasts.reduce((sum, f) => sum + f.amountCents, 0);
    const surplus = totalIncome - totalFixedExpenses - totalBudgeted - totalSavings;

    return {
      income: totalIncome,
      fixedExpenses: totalFixedExpenses,
      budgeted: totalBudgeted,
      savings: totalSavings,
      surplus,
    };
  }, [forecasts.incomeForecasts, forecasts.expenseForecasts, forecasts.savingsForecasts, budgets.expandedBudgets]);

  return {
    budgets,
    forecasts,
    totals,
    isLoading,
  };
}
