import { getOrdinalSuffix } from '@/lib/utils';
import type { BudgetRule, Category, CreateEntity, ForecastRule } from '@/lib/types';

/** What a bill's group is called when its category no longer exists */
export const UNCATEGORISED_LABEL = 'Uncategorised';

/**
 * One expense on the Budget page. An expense with a due date is a bill (a
 * forecast rule) and one without is an allowance (a budget rule).
 */
export type Expense =
  | { kind: 'bill'; rule: ForecastRule }
  | { kind: 'allowance'; rule: BudgetRule };

/** An expense that has not been saved yet, so it has no id or timestamps */
export type NewExpense =
  | { kind: 'bill'; data: CreateEntity<ForecastRule> }
  | { kind: 'allowance'; data: CreateEntity<BudgetRule> };

/**
 * The start and end dates a rule stores, for carrying over when an expense
 * moves between bills and allowances. Both kinds have them, and a
 * fortnightly bill's start date sets which weeks it lands in.
 */
export function ruleDateRange(
  rule: Pick<ForecastRule, 'startDate' | 'endDate'>,
): Pick<ForecastRule, 'startDate' | 'endDate'> {
  return {
    ...(rule.startDate !== undefined && { startDate: rule.startDate }),
    ...(rule.endDate !== undefined && { endDate: rule.endDate }),
  };
}

/** One category's expenses on the Budget page */
export interface ExpenseGroup {
  /** Null for bills whose category no longer exists */
  categoryId: string | null;
  name: string;
  bills: ForecastRule[];
  allowances: BudgetRule[];
}

/**
 * Group bills and allowances by category, sorted by category name.
 *
 * An allowance in an archived or missing category is left out. A bill is
 * always listed, under "Uncategorised" when its category no longer exists.
 */
export function groupExpensesByCategory(
  bills: ForecastRule[],
  allowances: BudgetRule[],
  categories: Category[],
): ExpenseGroup[] {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const groupsByCategoryId = new Map<string | null, ExpenseGroup>();

  const groupFor = (category: Category | undefined): ExpenseGroup => {
    const categoryId = category?.id ?? null;
    let group = groupsByCategoryId.get(categoryId);
    if (!group) {
      group = {
        categoryId,
        name: category?.name ?? UNCATEGORISED_LABEL,
        bills: [],
        allowances: [],
      };
      groupsByCategoryId.set(categoryId, group);
    }
    return group;
  };

  for (const bill of bills) {
    const category = bill.categoryId ? categoriesById.get(bill.categoryId) : undefined;
    groupFor(category).bills.push(bill);
  }

  for (const allowance of allowances) {
    const category = categoriesById.get(allowance.categoryId);
    if (!category || category.isArchived) continue;
    groupFor(category).allowances.push(allowance);
  }

  return Array.from(groupsByCategoryId.values()).sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}

const MONTH_OF_QUARTER_LABELS = ['first', 'second', 'third'];

function weekdayName(dayOfWeek: number): string {
  // 2 January 2000 was a Sunday, which is day 0
  return new Date(2000, 0, 2 + dayOfWeek).toLocaleDateString('en-AU', { weekday: 'long' });
}

function monthName(monthOfYear: number): string {
  return new Date(2000, monthOfYear, 1).toLocaleDateString('en-AU', { month: 'long' });
}

/**
 * When a bill falls due, in words: "Due on the 15th of each month".
 *
 * A day the rule does not store falls back to the one `expandForecastRule`
 * in `cadence.ts` uses, so the words match the dates Cash Flow shows.
 */
export function describeBillDue(
  bill: Pick<
    ForecastRule,
    'cadence' | 'dayOfWeek' | 'dayOfMonth' | 'monthOfYear' | 'monthOfQuarter'
  >,
): string {
  const dayOfMonth = bill.dayOfMonth ?? 1;
  const ordinalDay = `${dayOfMonth}${getOrdinalSuffix(dayOfMonth)}`;

  switch (bill.cadence) {
    case 'weekly':
      return `Due every ${weekdayName(bill.dayOfWeek ?? 0)}`;
    case 'fortnightly':
      return `Due every second ${weekdayName(bill.dayOfWeek ?? 0)}`;
    case 'monthly':
      return `Due on the ${ordinalDay} of each month`;
    case 'quarterly': {
      const monthOfQuarter = MONTH_OF_QUARTER_LABELS[bill.monthOfQuarter ?? 0] ?? 'first';
      return `Due on the ${ordinalDay} of the ${monthOfQuarter} month of each quarter`;
    }
    case 'yearly':
      return `Due on ${dayOfMonth} ${monthName(bill.monthOfYear ?? 0)} each year`;
  }
}
