import { useMemo } from 'react';
import { useTransactions } from './use-transactions';
import { useAdjustedBudgets, useAdjustedForecasts } from './use-adjusted-values';
import { getMonthsBetween, toMonthlyCents, type CadenceType } from '@/lib/utils';

export interface MonthSummary {
  month: string;           // YYYY-MM
  monthIndex: number;      // 0-11
  year: number;
  label: string;           // "January"
  shortLabel: string;      // "Jan"
  surplus: number;         // income - expenses - savings (positive = surplus, negative = shortfall)
  isCurrentMonth: boolean;
  isFuture: boolean;
  isPast: boolean;
  income: number;
  expenses: number;
  savings: number;
  totalBudget: number;     // fixed + variable budget for the month
  budgetDiff: number;      // budget - actual expenses (positive = under budget)
}

interface UseMultiPeriodSummaryOptions {
  scenarioId: string | null;
  year: number;
  /** If provided, returns 12 months centered around this month instead of calendar year */
  centerMonth?: { monthIndex: number; year: number };
}

interface UseMultiPeriodSummaryResult {
  isLoading: boolean;
  months: MonthSummary[];
  yearSummary: {
    totalSurplus: number;
    monthsWithSurplus: number;
    monthsWithShortfall: number;
  };
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Hook for getting summary data for all months in a year
 * Used by: Trend Sparkline, Year Grid, Quarter View
 */
export function useMultiPeriodSummary({
  scenarioId,
  year,
  centerMonth,
}: UseMultiPeriodSummaryOptions): UseMultiPeriodSummaryResult {
  // Calculate date range based on mode
  const { startDate, endDate } = useMemo(() => {
    if (centerMonth) {
      // 6 months back from center, center month, 5 months forward = 12 months total
      const center = new Date(centerMonth.year, centerMonth.monthIndex, 1);
      const start = new Date(center.getFullYear(), center.getMonth() - 6, 1);
      const end = new Date(center.getFullYear(), center.getMonth() + 6, 0); // Last day of month 5 ahead
      return {
        startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`,
        endDate: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
      };
    }
    // Full calendar year
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }, [year, centerMonth]);

  const { allTransactions, isLoading: transactionsLoading } = useTransactions();
  const { budgetRules, isLoading: budgetLoading } = useAdjustedBudgets(scenarioId);
  const { expandedForecasts, isLoading: forecastsLoading } = useAdjustedForecasts(scenarioId, startDate, endDate);

  const isLoading = transactionsLoading || budgetLoading || forecastsLoading;

  const months = useMemo((): MonthSummary[] => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const todayStr = today.toISOString().slice(0, 10);

    const monthKeys = getMonthsBetween(startDate, endDate);

    return monthKeys.map((monthKey) => {
      const [y, m] = monthKey.split('-').map(Number);
      const monthIndex = m! - 1;
      const monthYear = y!;

      const monthStart = `${monthKey}-01`;
      const lastDay = new Date(monthYear, monthIndex + 1, 0).getDate();
      const monthEnd = `${monthKey}-${String(lastDay).padStart(2, '0')}`;

      const isCurrentMonth = monthYear === currentYear && monthIndex === currentMonth;
      const isFuture = monthStart > todayStr;
      const isPast = monthEnd < todayStr;

      // Filter transactions for this month
      const monthTransactions = allTransactions.filter(
        (t) => t.date >= monthStart && t.date <= monthEnd,
      );

      // Actual values from transactions
      const incomeActual = monthTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amountCents, 0);

      const expensesActual = monthTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amountCents, 0);

      const savingsActual = monthTransactions
        .filter((t) => t.type === 'savings')
        .reduce((sum, t) => sum + t.amountCents, 0);

      // Forecasted values (only for future dates)
      const monthForecasts = expandedForecasts.filter(
        (f) => f.date >= monthStart && f.date <= monthEnd && f.date > todayStr,
      );

      const incomeForecast = monthForecasts
        .filter((f) => f.type === 'income')
        .reduce((sum, f) => sum + f.amountCents, 0);

      const expensesForecast = monthForecasts
        .filter((f) => f.type === 'expense')
        .reduce((sum, f) => sum + f.amountCents, 0);

      const savingsForecast = monthForecasts
        .filter((f) => f.type === 'savings')
        .reduce((sum, f) => sum + f.amountCents, 0);

      // Combined: actual + forecast for remaining period
      const income = incomeActual + incomeForecast;
      const expenses = expensesActual + expensesForecast;
      const savings = savingsActual + savingsForecast;

      // Calculate budget for this month (fixed expenses + variable budget)
      const fixedExpenses = expandedForecasts
        .filter((f) => f.type === 'expense' && f.date >= monthStart && f.date <= monthEnd)
        .reduce((sum, f) => sum + f.amountCents, 0);

      const variableBudget = budgetRules.reduce((sum, rule) => {
        return sum + toMonthlyCents(rule.amountCents, rule.cadence as CadenceType);
      }, 0);

      const totalBudget = fixedExpenses + variableBudget;

      // Surplus = income - expenses - savings
      const surplus = income - expenses - savings;

      // Budget diff = budget - actual expenses (positive = under budget)
      const budgetDiff = totalBudget - expensesActual;

      return {
        month: monthKey,
        monthIndex,
        year: monthYear,
        label: MONTH_LABELS[monthIndex]!,
        shortLabel: SHORT_LABELS[monthIndex]!,
        surplus,
        isCurrentMonth,
        isFuture,
        isPast,
        income,
        expenses,
        savings,
        totalBudget,
        budgetDiff,
      };
    });
  }, [allTransactions, expandedForecasts, budgetRules, startDate, endDate]);

  const yearSummary = useMemo(() => {
    const totalSurplus = months.reduce((sum, m) => sum + m.surplus, 0);
    const monthsWithSurplus = months.filter((m) => m.surplus > 0).length;
    const monthsWithShortfall = months.filter((m) => m.surplus < 0).length;

    return { totalSurplus, monthsWithSurplus, monthsWithShortfall };
  }, [months]);

  return {
    isLoading,
    months,
    yearSummary,
  };
}
