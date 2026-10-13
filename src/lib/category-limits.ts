import { expandForecastRule } from '@/lib/cadence';
import type { BudgetRule, ForecastRule } from '@/lib/types';
import { toMonthlyCents } from '@/lib/utils';

/**
 * What a category can spend in a month: the bills (expense forecast rules) that
 * fall due in it plus its allowance (budget rule). Spending in the category is
 * measured against the total, because a bill's transaction counts as spending
 * in that category too.
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
 * to monthEnd, keyed by category id. A category with no bill due and no
 * allowance in that month has no entry.
 *
 * Bills count on the dates they fall due, at their real amount. A $300
 * quarterly bill adds $300 to the month it is due in and nothing to the other
 * two; a weekly bill adds four or five payments depending on the month. A
 * bill's own start and end dates and its excluded dates are honoured, so an
 * occurrence outside them is not due.
 *
 * Allowances are averaged to a monthly figure whatever their cadence, because
 * an allowance is a rate of spending and has no due date. One that ended before
 * the month or starts after it is left out; one active for only part of the
 * month still counts in full.
 *
 * Given a range longer than a month, the bills are everything due in that
 * range and the allowance is still one month's worth.
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

    const occurrencesDue = expandForecastRule(forecastRule, monthStart, monthEnd);
    if (occurrencesDue.length === 0) continue;

    const limit = limitFor(forecastRule.categoryId);
    limit.billsCents += occurrencesDue.reduce((sum, occurrence) => sum + occurrence.amountCents, 0);
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

/**
 * Every category's allowance for the month, added up. Built from the same
 * limits the category rows use, so a page's total is the sum of its rows.
 */
export function sumMonthlyAllowanceCents(
  budgetRules: BudgetRule[],
  monthStart: string,
  monthEnd: string,
): number {
  const limitsByCategory = buildMonthlyLimitsByCategory(budgetRules, [], monthStart, monthEnd);
  return Object.values(limitsByCategory).reduce((sum, limit) => sum + limit.allowanceCents, 0);
}
