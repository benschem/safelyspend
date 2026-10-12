import type { BudgetRule, ForecastRule } from '@/lib/types';
import { toMonthlyCents } from '@/lib/utils';

/**
 * What a category can spend in a month: its bills (expense forecast rules) plus
 * its allowance (budget rule). Spending in the category is measured against the
 * total, because a bill's transaction counts as spending in that category too.
 */
export interface CategoryMonthlyLimit {
  billsCents: number;
  allowanceCents: number;
  totalCents: number;
}

/**
 * Build every category's monthly limit, keyed by category id. A category with
 * neither a bill nor an allowance has no entry.
 *
 * Bills are averaged to a monthly figure whatever their cadence, so a $300
 * quarterly bill adds $100 to every month.
 *
 * Allowances are summed. Only one budget rule per category is meant to exist,
 * but imported data can hold more, and the page totals add up every rule, so
 * summing keeps the rows equal to the total.
 */
export function buildMonthlyLimitsByCategory(
  budgetRules: BudgetRule[],
  forecastRules: ForecastRule[],
): Record<string, CategoryMonthlyLimit> {
  const limitsByCategory: Record<string, CategoryMonthlyLimit> = {};

  const limitFor = (categoryId: string): CategoryMonthlyLimit => {
    const existingLimit = limitsByCategory[categoryId];
    if (existingLimit) return existingLimit;

    const newLimit = { billsCents: 0, allowanceCents: 0, totalCents: 0 };
    limitsByCategory[categoryId] = newLimit;
    return newLimit;
  };

  // Bills go in before allowances. Cash Flow lists bill-only categories in this
  // object's key order, so swapping the two loops would reorder its rows.
  for (const forecastRule of forecastRules) {
    if (forecastRule.type !== 'expense' || !forecastRule.categoryId) continue;

    const limit = limitFor(forecastRule.categoryId);
    limit.billsCents += toMonthlyCents(forecastRule.amountCents, forecastRule.cadence);
  }

  for (const budgetRule of budgetRules) {
    const limit = limitFor(budgetRule.categoryId);
    limit.allowanceCents += toMonthlyCents(budgetRule.amountCents, budgetRule.cadence);
  }

  for (const limit of Object.values(limitsByCategory)) {
    limit.totalCents = limit.billsCents + limit.allowanceCents;
  }

  return limitsByCategory;
}
