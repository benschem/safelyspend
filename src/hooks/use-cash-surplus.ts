import { useMemo } from 'react';
import { useBalanceAnchors } from './use-balance-anchors';
import { useTransactions } from './use-transactions';
import { cashBalanceOn } from '@/lib/balances';
import { today as getToday } from '@/lib/dates';

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
  const { anchors: balanceAnchors } = useBalanceAnchors();
  const { allTransactions } = useTransactions();

  const today = useMemo(() => getToday(), []);

  return useMemo(() => {
    const balanceDate = isPastPeriod ? periodEnd : today;
    const balance = cashBalanceOn(balanceAnchors, allTransactions, balanceDate);

    if (balance === null) {
      return { currentBalance: null, cashSurplus: null, hasAnchor: false };
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
  }, [
    today,
    isPastPeriod,
    periodEnd,
    balanceAnchors,
    allTransactions,
    remainingIncome,
    remainingExpenses,
  ]);
}
