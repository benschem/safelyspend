import { toPeriodCents } from '@/lib/plan-amounts';
import { CADENCE_PER_LABELS, formatCents, pluralise } from '@/lib/utils';
import type { Cadence, Transaction } from '@/lib/types';

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_YEAR = 365;
const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;

// Under a month of history an average is a guess: one grocery shop in the
// first week would read as a month's worth four times over
const MINIMUM_DAYS_OF_HISTORY = 30;

export interface SpendingAverages {
  /** How many months the averages are spread over, from 1 to 12 */
  monthsOfHistory: number;
  /** Average spent per month in each category, in cents */
  monthlyCentsByCategory: Record<string, number>;
}

function daysFromTo(startDate: string, endDate: string): number {
  const startTime = Date.parse(`${startDate}T00:00:00Z`);
  const endTime = Date.parse(`${endDate}T00:00:00Z`);
  return Math.round((endTime - startTime) / MILLISECONDS_PER_DAY);
}

function oneYearBefore(date: string): string {
  const yearAgo = new Date(`${date}T00:00:00Z`);
  yearAgo.setUTCDate(yearAgo.getUTCDate() - (DAYS_PER_YEAR - 1));
  return yearAgo.toISOString().slice(0, 10);
}

/**
 * What was spent in each category, as an average per month, over the last
 * twelve months or over all the history there is when that is less.
 *
 * This is a plain mean on purpose. A $1,700 car repair once a year should read
 * as about $142 a month, because that is what has to be set aside to cover it.
 * A median would hide exactly the bill the allowance is there for.
 *
 * Every category is averaged over the same stretch: from the first expense in
 * any category, not the first in its own. A category whose only transaction is
 * that one repair would otherwise be averaged over a single month.
 *
 * Returns null when there is under a month of spending to go on.
 */
export function averageMonthlySpendingByCategory(
  transactions: Transaction[],
  todayDate: string,
): SpendingAverages | null {
  const pastExpenses = transactions.filter(
    (transaction) => transaction.type === 'expense' && transaction.date <= todayDate,
  );
  if (pastExpenses.length === 0) return null;

  const firstExpenseDate = pastExpenses.reduce(
    (earliest, transaction) => (transaction.date < earliest ? transaction.date : earliest),
    todayDate,
  );
  const yearWindowStart = oneYearBefore(todayDate);
  const historyStartDate = firstExpenseDate > yearWindowStart ? firstExpenseDate : yearWindowStart;

  const daysOfHistory = daysFromTo(historyStartDate, todayDate) + 1;
  if (daysOfHistory < MINIMUM_DAYS_OF_HISTORY) return null;
  const exactMonthsOfHistory = daysOfHistory / DAYS_PER_MONTH;

  const totalCentsByCategory: Record<string, number> = {};
  for (const transaction of pastExpenses) {
    if (!transaction.categoryId || transaction.date < historyStartDate) continue;
    totalCentsByCategory[transaction.categoryId] =
      (totalCentsByCategory[transaction.categoryId] ?? 0) + transaction.amountCents;
  }

  const monthlyCentsByCategory: Record<string, number> = {};
  for (const [categoryId, totalCents] of Object.entries(totalCentsByCategory)) {
    monthlyCentsByCategory[categoryId] = Math.round(totalCents / exactMonthsOfHistory);
  }

  return {
    monthsOfHistory: Math.max(1, Math.round(exactMonthsOfHistory)),
    monthlyCentsByCategory,
  };
}

/**
 * The line shown beside an allowance: what the category has cost, at the
 * allowance's own frequency. Null when nothing was spent there, or when there
 * is too little history to average.
 */
export function describeAverageSpending(
  spendingAverages: SpendingAverages | null | undefined,
  categoryId: string,
  cadence: Cadence,
): string | null {
  const monthlyCents = spendingAverages?.monthlyCentsByCategory[categoryId];
  if (!spendingAverages || !monthlyCents || monthlyCents <= 0) return null;

  const { monthsOfHistory } = spendingAverages;
  const amount = formatCents(toPeriodCents(monthlyCents, 'monthly', cadence));
  const history = monthsOfHistory === 1 ? 'month' : pluralise(monthsOfHistory, 'month');

  return `You've spent about ${amount} ${CADENCE_PER_LABELS[cadence]} here over the last ${history}`;
}
