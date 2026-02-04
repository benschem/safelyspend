import { useMemo } from 'react';
import { useBalanceAnchors } from './use-balance-anchors';
import { useTransactions } from './use-transactions';

interface UseCashSurplusOptions {
  periodEnd: string;
  isPastPeriod: boolean;
  /** Expected remaining income for the rest of the period */
  remainingIncome: number;
  /** Expected remaining expenses for the rest of the period (fixed + projected variable) */
  remainingExpenses: number;
}

interface UseCashSurplusResult {
  /** Cash balance right now (or at period end for past) */
  currentBalance: number | null;
  /** Projected cash balance at end of period (or null if no anchor) */
  cashSurplus: number | null;
  /** Whether a balance anchor exists */
  hasAnchor: boolean;
}

export function useCashSurplus({
  periodEnd,
  isPastPeriod,
  remainingIncome,
  remainingExpenses,
}: UseCashSurplusOptions): UseCashSurplusResult {
  const { getActiveAnchor } = useBalanceAnchors();
  const { allTransactions } = useTransactions();

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  return useMemo(() => {
    const balanceDate = isPastPeriod ? periodEnd : today;
    const activeAnchor = getActiveAnchor(balanceDate);

    if (!activeAnchor) {
      return { currentBalance: null, cashSurplus: null, hasAnchor: false };
    }

    // Walk transactions from anchor to balance date
    const transactionsFromAnchor = allTransactions.filter(
      (t) => t.date >= activeAnchor.date && t.date <= balanceDate,
    );

    let balance = activeAnchor.balanceCents;
    for (const t of transactionsFromAnchor) {
      if (t.type === 'income' || t.type === 'adjustment') {
        balance += t.amountCents;
      } else {
        // expense and savings both reduce cash
        balance -= t.amountCents;
      }
    }

    if (isPastPeriod) {
      // Past: balance at period end is the actual cash position
      return { currentBalance: balance, cashSurplus: balance, hasAnchor: true };
    }

    // Current/future: project forward with remaining income, expenses, and savings
    return {
      currentBalance: balance,
      cashSurplus: balance + remainingIncome - remainingExpenses,
      hasAnchor: true,
    };
  }, [today, isPastPeriod, periodEnd, getActiveAnchor, allTransactions, remainingIncome, remainingExpenses]);
}
