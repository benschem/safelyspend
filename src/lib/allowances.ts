import { daysBetween, parseLocalDate } from '@/lib/dates';
import { toPeriodCents } from '@/lib/plan-amounts';
import type { BudgetRule, Cadence } from '@/lib/types';

/** What an allowance with no name is called wherever allowances are listed */
export const UNNAMED_ALLOWANCE_LABEL = 'General spending';

export function allowanceLabel(allowance: Pick<BudgetRule, 'name'>): string {
  return allowance.name ?? UNNAMED_ALLOWANCE_LABEL;
}

/**
 * A name in the form used to compare two allowances: trimmed and lower case,
 * so "Lashes" and " lashes" are the same name. No name is the empty string,
 * which makes "no name" a name like any other.
 */
function comparableName(name: string | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

/**
 * Whether a category already holds an allowance of this name. An allowance's
 * name is unique within its category, and so is having no name, because two
 * that match cannot be told apart on screen or matched to the default plan.
 *
 * Pass the allowance being edited so it is not compared with itself. One that
 * keeps its category and name is never refused, even when another allowance
 * already matches it: converted or synced data can hold such a pair, and
 * refusing would stop either of them being saved until one was renamed.
 */
export function isAllowanceNameTaken(
  allowances: BudgetRule[],
  categoryId: string,
  name: string | undefined,
  editedAllowance?: BudgetRule | null,
): boolean {
  const keepsCategoryAndName =
    !!editedAllowance &&
    editedAllowance.categoryId === categoryId &&
    comparableName(editedAllowance.name) === comparableName(name);
  if (keepsCategoryAndName) return false;

  return allowances.some(
    (allowance) =>
      allowance.id !== editedAllowance?.id &&
      allowance.categoryId === categoryId &&
      comparableName(allowance.name) === comparableName(name),
  );
}

/** Every allowance in one category, in the order given */
export function allowancesForCategory(allowances: BudgetRule[], categoryId: string): BudgetRule[] {
  return allowances.filter((allowance) => allowance.categoryId === categoryId);
}

/**
 * What a list of allowances comes to over a period, each averaged from its own
 * amount and cadence. $80 a fortnight and $60 a month is $233.33 a month.
 */
export function sumAllowancesForPeriod(allowances: BudgetRule[], period: Cadence): number {
  return allowances.reduce(
    (sum, allowance) => sum + toPeriodCents(allowance.amountCents, allowance.cadence, period),
    0,
  );
}

/**
 * Calculate how many occurrences of a cadence fall within a date range
 */
function countOccurrences(cadence: Cadence, startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const diffDays = daysBetween(startDate, endDate) + 1;

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
 * Expand every budget rule over a date range and add the results up by
 * category. A category with several allowances gets their total.
 */
export function expandBudgetsByCategory(
  budgetRules: BudgetRule[],
  rangeStart: string,
  rangeEnd: string,
): Record<string, number> {
  const expandedByCategory: Record<string, number> = {};
  for (const rule of budgetRules) {
    expandedByCategory[rule.categoryId] =
      (expandedByCategory[rule.categoryId] ?? 0) + expandBudgetRule(rule, rangeStart, rangeEnd);
  }
  return expandedByCategory;
}
