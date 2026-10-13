import type { AllowanceItem, BudgetRule } from '@/lib/types';

/**
 * An allowance can be split into named items, such as lashes and nails under
 * Health and Beauty. The items are a breakdown of the one allowance: spending
 * is still measured against the category's total, and the total is always the
 * sum of the items.
 */
export type ItemisedAllowance = BudgetRule & { items: AllowanceItem[] };

/** Whether an allowance is made up of items. An empty list counts as none. */
export function isItemisedAllowance(
  budgetRule: BudgetRule | null | undefined,
): budgetRule is ItemisedAllowance {
  return budgetRule?.items !== undefined && budgetRule.items.length > 0;
}

export function sumAllowanceItemCents(items: AllowanceItem[]): number {
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}

/**
 * What an allowance's amount should be stored as. With items it is their sum,
 * whatever amount was asked for, so the two can never disagree.
 */
export function resolveAllowanceAmountCents(
  requestedAmountCents: number,
  items: AllowanceItem[] | undefined,
): number {
  if (items === undefined || items.length === 0) return requestedAmountCents;
  return sumAllowanceItemCents(items);
}
