import { addDays } from '@/lib/dates';
import type { BalanceAnchor, SavingsAnchor, Transaction } from '@/lib/types';

/**
 * Balances as of a date, for cash and for one savings goal.
 *
 * A balance is the latest anchor on or before the date, plus the transactions
 * from the anchor's date up to and including the date asked for. An anchor is
 * the balance at the start of its day, so a transaction on the anchor's own
 * date counts.
 */

/**
 * The latest anchor on or before a date, or null when there is none.
 *
 * The anchors can be in any order. For a savings goal, pass only that goal's
 * anchors. Two anchors on one date are not expected: the first one in the
 * list wins.
 */
export function findActiveAnchor<DatedAnchor extends { date: string }>(
  anchors: DatedAnchor[],
  asOfDate: string,
): DatedAnchor | null {
  let activeAnchor: DatedAnchor | null = null;

  for (const anchor of anchors) {
    if (anchor.date > asOfDate) continue;
    if (activeAnchor === null || anchor.date > activeAnchor.date) {
      activeAnchor = anchor;
    }
  }

  return activeAnchor;
}

/**
 * What one transaction does to cash. Income and adjustments add to it.
 * Expenses and transfers to savings take from it.
 */
export function cashEffectCents(transaction: Transaction): number {
  if (transaction.type === 'income' || transaction.type === 'adjustment') {
    return transaction.amountCents;
  }
  return -transaction.amountCents;
}

/**
 * The cash balance at the end of a day, or null when no anchor falls on or
 * before that day.
 */
export function cashBalanceOn(
  balanceAnchors: BalanceAnchor[],
  transactions: Transaction[],
  asOfDate: string,
): number | null {
  const activeAnchor = findActiveAnchor(balanceAnchors, asOfDate);
  if (activeAnchor === null) return null;

  let balanceCents = activeAnchor.balanceCents;
  for (const transaction of transactions) {
    if (transaction.date >= activeAnchor.date && transaction.date <= asOfDate) {
      balanceCents += cashEffectCents(transaction);
    }
  }
  return balanceCents;
}

/**
 * One savings goal's balance at the end of a day.
 *
 * With no anchor on or before that day, it is the sum of the goal's savings
 * transactions up to and including the day.
 */
export function savingsBalanceOn(
  savingsAnchors: SavingsAnchor[],
  transactions: Transaction[],
  savingsGoalId: string,
  asOfDate: string,
): number {
  const goalAnchors = savingsAnchors.filter((anchor) => anchor.savingsGoalId === savingsGoalId);
  const activeAnchor = findActiveAnchor(goalAnchors, asOfDate);

  let balanceCents = activeAnchor?.balanceCents ?? 0;
  for (const transaction of transactions) {
    if (transaction.type !== 'savings' || transaction.savingsGoalId !== savingsGoalId) continue;
    if (transaction.date > asOfDate) continue;
    if (activeAnchor !== null && transaction.date < activeAnchor.date) continue;

    balanceCents += transaction.amountCents;
  }
  return balanceCents;
}

/**
 * The figure one goal's savings chart starts from, for a date range. The chart
 * adds each month's transfers in the range to it.
 *
 * It is the goal's balance as the range opens: an anchor dated on the first
 * day, or else the balance at the end of the day before.
 *
 * A goal whose first anchor falls inside the range has no known balance
 * before that anchor. Its figure is the anchor's balance less the range's
 * transfers dated before the anchor, so the chart reaches the anchor's balance
 * on the anchor's date. The chart hides the months before it.
 */
export function savingsBalanceAtRangeStart(
  savingsAnchors: SavingsAnchor[],
  transactions: Transaction[],
  savingsGoalId: string,
  startDate: string,
  endDate: string,
): number {
  const goalAnchors = savingsAnchors.filter((anchor) => anchor.savingsGoalId === savingsGoalId);

  const anchorOnStartDate = goalAnchors.find((anchor) => anchor.date === startDate);
  if (anchorOnStartDate) return anchorOnStartDate.balanceCents;

  const hasAnchorBeforeRange = goalAnchors.some((anchor) => anchor.date < startDate);
  const firstAnchorInRange = goalAnchors
    .filter((anchor) => anchor.date > startDate && anchor.date <= endDate)
    .sort((earlier, later) => earlier.date.localeCompare(later.date))[0];

  if (hasAnchorBeforeRange || !firstAnchorInRange) {
    return savingsBalanceOn(savingsAnchors, transactions, savingsGoalId, addDays(startDate, -1));
  }

  let transfersBeforeAnchorCents = 0;
  for (const transaction of transactions) {
    if (transaction.type !== 'savings' || transaction.savingsGoalId !== savingsGoalId) continue;
    if (transaction.date >= startDate && transaction.date < firstAnchorInRange.date) {
      transfersBeforeAnchorCents += transaction.amountCents;
    }
  }
  return firstAnchorInRange.balanceCents - transfersBeforeAnchorCents;
}
