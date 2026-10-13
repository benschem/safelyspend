import { useMemo } from 'react';
import { useAdjustedBudgets, useAdjustedForecasts } from './use-adjusted-values';
import { useTransactions } from './use-transactions';
import { useCategories } from './use-categories';
import type {
  BudgetRule,
  ForecastRule,
  Category,
  Transaction,
  ExpandedForecast,
} from '@/lib/types';
import {
  buildMonthlyLimitsByCategory,
  isRuleActiveBetween,
  sumMonthlyAllowanceCents,
} from '@/lib/category-limits';
import { buildCategoryColorMap } from '@/lib/chart-colors';
import { daysBetween, formatISODate, today as getToday } from '@/lib/dates';

interface PeriodCashFlow {
  dayOfPeriod: number;
  daysInPeriod: number;
  income: { expected: number; actual: number };
  budgeted: { expected: number };
  savings: { expected: number; actual: number };
  expenses: {
    expected: number;
    actual: number;
    /** The part of actual spending that went on bills; the rest is day-to-day */
    paidTowardsBills: number;
  };
  net: { projected: number; forecasted: number };
  projection: {
    /** Day-to-day spending so far: actual spending less what went on bills */
    variableActual: number;
    projectedVariable: number;
    projectedTotal: number;
  };
}

interface BudgetSummary {
  overCount: number;
  overspendingCount: number;
  goodCount: number;
  trackedCount: number;
  totalSavingsForecasted: number;
}

interface CategorySpending {
  id: string;
  name: string;
  amount: number;
  budget: number;
}

interface PeriodSpending {
  categorySpending: CategorySpending[];
  total: number;
}

interface ForecastExpense {
  id: string;
  description: string;
  amount: number;
  date: string;
  categoryId: string | null;
  categoryName: string | null;
}

interface ForecastExpensesByCategory {
  id: string;
  name: string;
  amount: number;
  items: ForecastExpense[];
}

interface BurnRateData {
  dailySpending: { date: string; amount: number }[];
  totalBudget: number;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  fixedExpenseSchedule: { date: string; amount: number }[];
  variableBudget: number;
  fixedExpensesTotal: number;
}

interface UseBudgetPeriodDataOptions {
  scenarioId: string | null;
  selectedMonth: Date;
  viewMode: 'month' | 'quarter' | 'year';
}

interface UseBudgetPeriodDataResult {
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  isCurrentPeriod: boolean;
  isFuturePeriod: boolean;
  isPastPeriod: boolean;
  isLoading: boolean;
  periodCashFlow: PeriodCashFlow;
  summary: BudgetSummary;
  periodSpending: PeriodSpending;
  forecastExpenses: ForecastExpensesByCategory[];
  burnRateData: BurnRateData;
  colorMap: Record<string, string>;
}

/**
 * How much of the spending so far is day-to-day, as opposed to paying bills.
 *
 * Nothing links a transaction to the bill it pays, so the category stands in:
 * spending in a category counts towards that category's bills for the whole
 * period first, and only what is left over is day-to-day. That gives the same
 * answer whether a bill is paid early, late or on the day it is due.
 *
 * It also means that in a category with both a bill and day-to-day spending,
 * anything spent before the bill is paid reads as progress on the bill.
 *
 * A bill with no category has nothing to stand in for it. Those are taken off
 * spending that has no category either, and only once they are due. The dialog
 * does not allow a bill without a category, so this only arises from imports.
 */
function sumDayToDaySpending(
  periodForecasts: ExpandedForecast[],
  expenseTransactionsSoFar: Transaction[],
  effectiveDate: string,
): number {
  const billsByCategory = new Map<string, number>();
  let uncategorisedBillsDueSoFar = 0;

  for (const forecast of periodForecasts) {
    if (forecast.type !== 'expense') continue;

    if (forecast.categoryId) {
      const billsSoFar = billsByCategory.get(forecast.categoryId) ?? 0;
      billsByCategory.set(forecast.categoryId, billsSoFar + forecast.amountCents);
    } else if (forecast.date <= effectiveDate) {
      uncategorisedBillsDueSoFar += forecast.amountCents;
    }
  }

  const spentByCategory = new Map<string, number>();
  let uncategorisedSpent = 0;

  for (const transaction of expenseTransactionsSoFar) {
    if (transaction.categoryId) {
      const spentSoFar = spentByCategory.get(transaction.categoryId) ?? 0;
      spentByCategory.set(transaction.categoryId, spentSoFar + transaction.amountCents);
    } else {
      uncategorisedSpent += transaction.amountCents;
    }
  }

  let dayToDaySpending = Math.max(0, uncategorisedSpent - uncategorisedBillsDueSoFar);

  for (const [categoryId, spent] of spentByCategory) {
    const billsForCategory = billsByCategory.get(categoryId) ?? 0;
    dayToDaySpending += Math.max(0, spent - billsForCategory);
  }

  return dayToDaySpending;
}

/**
 * Which day of the period a date is, counting the period's first day as 1.
 * A period that is not the current one counts as finished.
 */
function dayOfPeriodOn(
  effectiveDate: string,
  periodStart: string,
  isCurrentPeriod: boolean,
  daysInPeriod: number,
): number {
  if (!isCurrentPeriod) return daysInPeriod;
  return daysBetween(periodStart, effectiveDate) + 1;
}

/**
 * Calculate period cash flow data
 */
export function calculatePeriodCashFlow(
  viewMode: 'month' | 'quarter' | 'year',
  selectedYear: number,
  selectedMonthIndex: number,
  periodStart: string,
  periodEnd: string,
  effectiveDate: string,
  isCurrentPeriod: boolean,
  isFuturePeriod: boolean,
  budgetRules: BudgetRule[],
  periodForecasts: ExpandedForecast[],
  savingsForecasts: ExpandedForecast[],
  allTransactions: Transaction[],
): PeriodCashFlow {
  // Calculate quarter boundaries
  const quarterStartMonth = Math.floor(selectedMonthIndex / 3) * 3;
  const quarterEndMonth = quarterStartMonth + 2;

  // Calculate days in period based on view mode
  let daysInPeriod: number;
  if (viewMode === 'year') {
    daysInPeriod = selectedYear % 4 === 0 ? 366 : 365;
  } else if (viewMode === 'quarter') {
    // Sum days in all 3 months of the quarter
    daysInPeriod = 0;
    for (let m = quarterStartMonth; m <= quarterEndMonth; m++) {
      daysInPeriod += new Date(selectedYear, m + 1, 0).getDate();
    }
  } else {
    daysInPeriod = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
  }

  const dayOfPeriod = dayOfPeriodOn(effectiveDate, periodStart, isCurrentPeriod, daysInPeriod);

  // Expected income for full period
  const expectedIncome = periodForecasts
    .filter((f) => f.type === 'income')
    .reduce((sum, f) => sum + f.amountCents, 0);

  // Expected savings for full period
  const expectedSavings = savingsForecasts.reduce((sum, f) => sum + f.amountCents, 0);

  // Expected expenses for full period
  const expectedExpenses = periodForecasts
    .filter((f) => f.type === 'expense')
    .reduce((sum, f) => sum + f.amountCents, 0);

  // Total allowances for the period, from the same limits the category rows
  // use, so the total is the sum of the rows. The helper returns a monthly
  // figure, so this is only exact in month view.
  const periodMultiplier = viewMode === 'year' ? 12 : viewMode === 'quarter' ? 3 : 1;
  const totalBudget =
    sumMonthlyAllowanceCents(budgetRules, periodStart, periodEnd) * periodMultiplier;

  // Actual income received so far
  const actualIncome = allTransactions
    .filter((t) => t.type === 'income' && t.date >= periodStart && t.date <= effectiveDate)
    .reduce((sum, t) => sum + t.amountCents, 0);

  // Actual savings so far
  const actualSavings = allTransactions
    .filter((t) => t.type === 'savings' && t.date >= periodStart && t.date <= effectiveDate)
    .reduce((sum, t) => sum + t.amountCents, 0);

  // Actual expenses so far
  const expenseTransactionsSoFar = allTransactions.filter(
    (t) => t.type === 'expense' && t.date >= periodStart && t.date <= effectiveDate,
  );
  const actualExpenses = expenseTransactionsSoFar.reduce((sum, t) => sum + t.amountCents, 0);

  // Net for period
  const actualNet = actualIncome - actualExpenses - actualSavings;

  // Forecasted remaining
  const forecastedIncome = isFuturePeriod
    ? periodForecasts.filter((f) => f.type === 'income').reduce((sum, f) => sum + f.amountCents, 0)
    : isCurrentPeriod
      ? periodForecasts
          .filter((f) => f.type === 'income' && f.date > effectiveDate)
          .reduce((sum, f) => sum + f.amountCents, 0)
      : 0;
  const forecastedExpenses = isFuturePeriod
    ? periodForecasts.filter((f) => f.type === 'expense').reduce((sum, f) => sum + f.amountCents, 0)
    : isCurrentPeriod
      ? periodForecasts
          .filter((f) => f.type === 'expense' && f.date > effectiveDate)
          .reduce((sum, f) => sum + f.amountCents, 0)
      : 0;
  const forecastedSavings = isFuturePeriod
    ? periodForecasts.filter((f) => f.type === 'savings').reduce((sum, f) => sum + f.amountCents, 0)
    : isCurrentPeriod
      ? periodForecasts
          .filter((f) => f.type === 'savings' && f.date > effectiveDate)
          .reduce((sum, f) => sum + f.amountCents, 0)
      : 0;

  const projectedNet = actualNet + forecastedIncome - forecastedExpenses - forecastedSavings;
  const forecastedNet = forecastedIncome - forecastedExpenses - forecastedSavings;

  // Smart projection: separate fixed vs variable spending
  const periodProgress = dayOfPeriod / daysInPeriod;
  const variableActual = sumDayToDaySpending(
    periodForecasts,
    expenseTransactionsSoFar,
    effectiveDate,
  );
  const paidTowardsBills = actualExpenses - variableActual;
  const projectedVariable =
    periodProgress > 0 ? Math.round(variableActual / periodProgress) : Math.round(totalBudget);
  const projectedTotal = Math.round(expectedExpenses) + projectedVariable;

  return {
    dayOfPeriod,
    daysInPeriod,
    income: { expected: Math.round(expectedIncome), actual: actualIncome },
    budgeted: { expected: totalBudget },
    savings: { expected: Math.round(expectedSavings), actual: actualSavings },
    expenses: {
      expected: Math.round(expectedExpenses),
      actual: actualExpenses,
      paidTowardsBills,
    },
    net: { projected: projectedNet, forecasted: forecastedNet },
    projection: {
      variableActual,
      projectedVariable,
      projectedTotal,
    },
  };
}

/**
 * Calculate budget summary stats
 */
export function calculateSummary(
  viewMode: 'month' | 'quarter' | 'year',
  selectedYear: number,
  selectedMonthIndex: number,
  periodStart: string,
  periodEnd: string,
  effectiveDate: string,
  isCurrentPeriod: boolean,
  budgetRules: BudgetRule[],
  forecastRules: ForecastRule[],
  periodForecasts: ExpandedForecast[],
  allTransactions: Transaction[],
): BudgetSummary {
  // Calculate quarter boundaries
  const quarterStartMonth = Math.floor(selectedMonthIndex / 3) * 3;
  const quarterEndMonth = quarterStartMonth + 2;

  // Calculate days in period based on view mode
  let daysInPeriod: number;
  if (viewMode === 'year') {
    daysInPeriod = selectedYear % 4 === 0 ? 366 : 365;
  } else if (viewMode === 'quarter') {
    daysInPeriod = 0;
    for (let m = quarterStartMonth; m <= quarterEndMonth; m++) {
      daysInPeriod += new Date(selectedYear, m + 1, 0).getDate();
    }
  } else {
    daysInPeriod = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
  }

  const dayOfPeriod = dayOfPeriodOn(effectiveDate, periodStart, isCurrentPeriod, daysInPeriod);

  const periodProgress = dayOfPeriod / daysInPeriod;

  let overCount = 0;
  let overspendingCount = 0;
  let goodCount = 0;

  const periodMultiplier = viewMode === 'year' ? 12 : viewMode === 'quarter' ? 3 : 1;

  // A category is tracked when it has an allowance in this period. Its
  // spending is judged against the whole limit, bills included, because a
  // bill's transaction counts as spending in the category too.
  // Bills are everything due in the period. The allowance comes back as a
  // monthly figure, so it is only exact in month view: over a quarter or year,
  // an allowance active for part of it counts for all of it.
  const monthlyLimitsByCategory = buildMonthlyLimitsByCategory(
    budgetRules,
    forecastRules,
    periodStart,
    periodEnd,
  );
  const trackedCategoryIds = new Set(
    budgetRules
      .filter((rule) => isRuleActiveBetween(rule, periodStart, periodEnd))
      .map((rule) => rule.categoryId),
  );

  for (const categoryId of trackedCategoryIds) {
    const limit = monthlyLimitsByCategory[categoryId];
    const periodBudget = (limit?.billsCents ?? 0) + (limit?.allowanceCents ?? 0) * periodMultiplier;

    const spent = allTransactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          t.categoryId === categoryId &&
          t.date >= periodStart &&
          t.date <= effectiveDate,
      )
      .reduce((sum, t) => sum + t.amountCents, 0);

    const spentPercent = periodBudget > 0 ? spent / periodBudget : 0;
    const expectedSpend = periodBudget * periodProgress;
    const burnRate = expectedSpend > 0 ? spent / expectedSpend : 0;

    if (spentPercent >= 1) {
      overCount++;
    } else if (burnRate > 1.2) {
      overspendingCount++;
    } else {
      goodCount++;
    }
  }

  const totalSavingsForecasted = periodForecasts
    .filter((f) => f.type === 'savings')
    .reduce((sum, f) => sum + f.amountCents, 0);

  return {
    overCount,
    overspendingCount,
    goodCount,
    trackedCount: trackedCategoryIds.size,
    totalSavingsForecasted,
  };
}

/**
 * Calculate spending by category
 */
export function calculatePeriodSpending(
  viewMode: 'month' | 'quarter' | 'year',
  periodStart: string,
  periodEnd: string,
  effectiveDate: string,
  budgetRules: BudgetRule[],
  forecastRules: ForecastRule[],
  activeCategories: Category[],
  allTransactions: Transaction[],
): PeriodSpending {
  const expenseTransactions = allTransactions.filter(
    (t) => t.type === 'expense' && t.date >= periodStart && t.date <= effectiveDate,
  );

  // Each category's budget is its whole limit, bills included, so it
  // matches what the over/on-track counts judge against. Bills are everything
  // due in the period; the allowance comes back as a monthly figure, so it is
  // only exact in month view.
  const periodMultiplier = viewMode === 'year' ? 12 : viewMode === 'quarter' ? 3 : 1;
  const monthlyLimitsByCategory = buildMonthlyLimitsByCategory(
    budgetRules,
    forecastRules,
    periodStart,
    periodEnd,
  );
  const budgetByCategory = new Map<string, number>();
  for (const [categoryId, limit] of Object.entries(monthlyLimitsByCategory)) {
    budgetByCategory.set(categoryId, limit.billsCents + limit.allowanceCents * periodMultiplier);
  }

  const byCategory: Record<string, number> = {};
  let uncategorized = 0;
  let total = 0;

  for (const tx of expenseTransactions) {
    total += tx.amountCents;
    if (tx.categoryId) {
      byCategory[tx.categoryId] = (byCategory[tx.categoryId] ?? 0) + tx.amountCents;
    } else {
      uncategorized += tx.amountCents;
    }
  }

  const categorySpending = activeCategories
    .map((c) => ({
      id: c.id,
      name: c.name,
      amount: byCategory[c.id] ?? 0,
      budget: budgetByCategory.get(c.id) ?? 0,
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  if (uncategorized > 0) {
    categorySpending.push({
      id: 'uncategorized',
      name: 'Uncategorised',
      amount: uncategorized,
      budget: 0,
    });
  }

  return { categorySpending, total };
}

/**
 * Calculate forecast expenses grouped by category
 */
function calculateForecastExpenses(
  periodForecasts: ExpandedForecast[],
  activeCategories: Category[],
): ForecastExpensesByCategory[] {
  const expenseForecasts = periodForecasts.filter((f) => f.type === 'expense');

  // Build category lookup
  const categoryMap = new Map(activeCategories.map((c) => [c.id, c.name]));

  // Group by category
  const byCategory = new Map<string, ForecastExpense[]>();

  for (const forecast of expenseForecasts) {
    const catId = forecast.categoryId ?? 'uncategorized';
    if (!byCategory.has(catId)) {
      byCategory.set(catId, []);
    }
    byCategory.get(catId)!.push({
      id: forecast.sourceId,
      description: forecast.description,
      amount: forecast.amountCents,
      date: forecast.date,
      categoryId: forecast.categoryId,
      categoryName: forecast.categoryId ? (categoryMap.get(forecast.categoryId) ?? null) : null,
    });
  }

  // Convert to array and sort by total amount
  const result: ForecastExpensesByCategory[] = [];

  for (const [catId, items] of byCategory) {
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    result.push({
      id: catId,
      name: catId === 'uncategorized' ? 'Uncategorised' : (categoryMap.get(catId) ?? 'Unknown'),
      amount: total,
      items: items.sort((a, b) => b.amount - a.amount),
    });
  }

  return result.sort((a, b) => b.amount - a.amount);
}

/**
 * Calculate burn rate chart data
 */
function calculateBurnRateData(
  viewMode: 'month' | 'quarter' | 'year',
  periodStart: string,
  periodEnd: string,
  periodLabel: string,
  budgetRules: BudgetRule[],
  periodForecasts: ExpandedForecast[],
  allTransactions: Transaction[],
): BurnRateData {
  const expenses = allTransactions.filter(
    (t) => t.type === 'expense' && t.date >= periodStart && t.date <= periodEnd,
  );

  const dailySpending = expenses.map((t) => ({
    date: t.date,
    amount: t.amountCents,
  }));

  const periodMultiplier = viewMode === 'year' ? 12 : viewMode === 'quarter' ? 3 : 1;
  const variableBudget =
    sumMonthlyAllowanceCents(budgetRules, periodStart, periodEnd) * periodMultiplier;
  const expenseForecasts = periodForecasts.filter((f) => f.type === 'expense');
  const fixedExpenseSchedule = expenseForecasts.map((f) => ({
    date: f.date,
    amount: f.amountCents,
  }));
  const fixedExpensesTotal = expenseForecasts.reduce((sum, f) => sum + f.amountCents, 0);

  return {
    dailySpending,
    totalBudget: Math.round(variableBudget + fixedExpensesTotal),
    periodStart,
    periodEnd,
    periodLabel,
    fixedExpenseSchedule,
    variableBudget: Math.round(variableBudget),
    fixedExpensesTotal: Math.round(fixedExpensesTotal),
  };
}

/**
 * Hook for calculating all budget period data
 */
export function useBudgetPeriodData({
  scenarioId,
  selectedMonth,
  viewMode,
}: UseBudgetPeriodDataOptions): UseBudgetPeriodDataResult {
  const { allTransactions, isLoading: transactionsLoading } = useTransactions();
  const { budgetRules, isLoading: budgetLoading } = useAdjustedBudgets(scenarioId);
  const { activeCategories, isLoading: categoriesLoading } = useCategories();

  // Calculate dates
  const today = getToday();
  const selectedYear = selectedMonth.getFullYear();
  const selectedMonthIndex = selectedMonth.getMonth();

  // Calculate quarter start month (0, 3, 6, or 9)
  const quarterStartMonth = Math.floor(selectedMonthIndex / 3) * 3;
  const quarterEndMonth = quarterStartMonth + 2;

  // Day 0 of a month is the last day of the month before it
  const periodStart =
    viewMode === 'year'
      ? `${selectedYear}-01-01`
      : viewMode === 'quarter'
        ? formatISODate(new Date(selectedYear, quarterStartMonth, 1))
        : formatISODate(new Date(selectedYear, selectedMonthIndex, 1));
  const periodEnd =
    viewMode === 'year'
      ? `${selectedYear}-12-31`
      : viewMode === 'quarter'
        ? formatISODate(new Date(selectedYear, quarterEndMonth + 1, 0))
        : formatISODate(new Date(selectedYear, selectedMonthIndex + 1, 0));

  const isCurrentPeriod = today >= periodStart && today <= periodEnd;
  const isFuturePeriod = periodStart > today;
  const isPastPeriod = periodEnd < today;
  const effectiveDate = isCurrentPeriod ? today : isFuturePeriod ? periodStart : periodEnd;

  const shortMonthName = selectedMonth.toLocaleDateString('en-AU', { month: 'long' });
  const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4'];
  const periodLabel =
    viewMode === 'year'
      ? String(selectedYear)
      : viewMode === 'quarter'
        ? `${quarterNames[Math.floor(selectedMonthIndex / 3)]} ${selectedYear}`
        : `${shortMonthName} ${selectedYear}`;

  // Get forecasts for the period (with What-If adjustments applied)
  const {
    rules: forecastRules,
    expandedForecasts: periodForecasts,
    savingsForecasts,
    isLoading: forecastsLoading,
  } = useAdjustedForecasts(scenarioId, periodStart, periodEnd);

  const isLoading = transactionsLoading || budgetLoading || categoriesLoading || forecastsLoading;

  // Build color map
  const colorMap = useMemo(() => {
    return buildCategoryColorMap(activeCategories.map((c) => c.id));
  }, [activeCategories]);

  // Calculate all derived data
  const periodCashFlow = useMemo(
    () =>
      calculatePeriodCashFlow(
        viewMode,
        selectedYear,
        selectedMonthIndex,
        periodStart,
        periodEnd,
        effectiveDate,
        isCurrentPeriod,
        isFuturePeriod,
        budgetRules,
        periodForecasts,
        savingsForecasts,
        allTransactions,
      ),
    [
      viewMode,
      selectedYear,
      selectedMonthIndex,
      periodStart,
      periodEnd,
      effectiveDate,
      isCurrentPeriod,
      isFuturePeriod,
      budgetRules,
      periodForecasts,
      savingsForecasts,
      allTransactions,
    ],
  );

  const summary = useMemo(
    () =>
      calculateSummary(
        viewMode,
        selectedYear,
        selectedMonthIndex,
        periodStart,
        periodEnd,
        effectiveDate,
        isCurrentPeriod,
        budgetRules,
        forecastRules,
        periodForecasts,
        allTransactions,
      ),
    [
      viewMode,
      selectedYear,
      selectedMonthIndex,
      periodStart,
      periodEnd,
      effectiveDate,
      isCurrentPeriod,
      budgetRules,
      forecastRules,
      periodForecasts,
      allTransactions,
    ],
  );

  const periodSpending = useMemo(
    () =>
      calculatePeriodSpending(
        viewMode,
        periodStart,
        periodEnd,
        effectiveDate,
        budgetRules,
        forecastRules,
        activeCategories,
        allTransactions,
      ),
    [
      viewMode,
      periodStart,
      periodEnd,
      effectiveDate,
      budgetRules,
      forecastRules,
      activeCategories,
      allTransactions,
    ],
  );

  const forecastExpenses = useMemo(
    () => calculateForecastExpenses(periodForecasts, activeCategories),
    [periodForecasts, activeCategories],
  );

  const burnRateData = useMemo(
    () =>
      calculateBurnRateData(
        viewMode,
        periodStart,
        periodEnd,
        periodLabel,
        budgetRules,
        periodForecasts,
        allTransactions,
      ),
    [viewMode, periodStart, periodEnd, periodLabel, budgetRules, periodForecasts, allTransactions],
  );

  return {
    periodStart,
    periodEnd,
    periodLabel,
    isCurrentPeriod,
    isFuturePeriod,
    isPastPeriod,
    isLoading,
    periodCashFlow,
    summary,
    periodSpending,
    forecastExpenses,
    burnRateData,
    colorMap,
  };
}
