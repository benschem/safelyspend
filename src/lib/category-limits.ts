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
 * Whether a rule applies on at least one day between two dates (inclusive).
 * A rule with no start date has always applied, and one with no end date
 * never stops. An empty string counts as no date, as it does where rules are
 * expanded, because imported data can hold one.
 */
export function isRuleActiveBetween(
  rule: { startDate?: string; endDate?: string },
  periodStart: string,
  periodEnd: string,
): boolean {
  const startsAfterPeriod = rule.startDate ? rule.startDate > periodEnd : false;
  const endsBeforePeriod = rule.endDate ? rule.endDate < periodStart : false;
  return !startsAfterPeriod && !endsBeforePeriod;
}

/**
 * Build every category's monthly limit for the month running from monthStart
 * to monthEnd, keyed by category id. A category with neither a bill nor an
 * allowance in that month has no entry.
 *
 * Rules that ended before the month or start after it are left out. A rule
 * active for only part of the month still counts in full.
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
  monthStart: string,
  monthEnd: string,
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
    if (!isRuleActiveBetween(forecastRule, monthStart, monthEnd)) continue;

    const limit = limitFor(forecastRule.categoryId);
    limit.billsCents += toMonthlyCents(forecastRule.amountCents, forecastRule.cadence);
  }

  for (const budgetRule of budgetRules) {
    if (!isRuleActiveBetween(budgetRule, monthStart, monthEnd)) continue;

    const limit = limitFor(budgetRule.categoryId);
    limit.allowanceCents += toMonthlyCents(budgetRule.amountCents, budgetRule.cadence);
  }

  for (const limit of Object.values(limitsByCategory)) {
    limit.totalCents = limit.billsCents + limit.allowanceCents;
  }

  return limitsByCategory;
}
