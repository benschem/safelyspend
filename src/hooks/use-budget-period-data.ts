import { useMemo } from 'react';
import { useBudgetRules } from './use-budget-rules';
import { useTransactions } from './use-transactions';
import { useForecasts } from './use-forecasts';
import { useCategories } from './use-categories';
import type { BudgetRule, Category, Transaction, ExpandedForecast } from '@/lib/types';
import { buildCategoryColorMap } from '@/lib/chart-colors';

interface PeriodCashFlow {
  dayOfPeriod: number;
  daysInPeriod: number;
  income: { expected: number; actual: number };
  budgeted: { expected: number; actual: number };
  unbudgeted: { unallocated: number; actual: number };
  savings: { expected: number; actual: number };
  expenses: { expected: number; actual: number };
  net: { projected: number; forecasted: number };
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
}

interface UseBudgetPeriodDataOptions {
  scenarioId: string | null;
  selectedMonth: Date;
  viewMode: 'month' | 'year';
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
 * Convert a budget rule's cadence amount to a monthly equivalent
 */
function toMonthlyAmount(amountCents: number, cadence: BudgetRule['cadence']): number {
  switch (cadence) {
    case 'weekly':
      return amountCents * 4.33;
    case 'fortnightly':
      return amountCents * 2.17;
    case 'monthly':
      return amountCents;
    case 'quarterly':
      return amountCents / 3;
    case 'yearly':
      return amountCents / 12;
    default:
      return amountCents;
  }
}

/**
 * Calculate period cash flow data
 */
function calculatePeriodCashFlow(
  viewMode: 'month' | 'year',
  selectedYear: number,
  selectedMonthIndex: number,
  periodStart: string,
  effectiveDate: string,
  isCurrentPeriod: boolean,
  isFuturePeriod: boolean,
  budgetRules: BudgetRule[],
  periodForecasts: ExpandedForecast[],
  savingsForecasts: ExpandedForecast[],
  allTransactions: Transaction[],
): PeriodCashFlow {
  const daysInPeriod = viewMode === 'year'
    ? (selectedYear % 4 === 0 ? 366 : 365)
    : new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
  const effectiveDateObj = new Date(effectiveDate);
  const dayOfPeriod = isCurrentPeriod
    ? (viewMode === 'year'
      ? Math.ceil((effectiveDateObj.getTime() - new Date(selectedYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24)) + 1
      : effectiveDateObj.getDate())
    : daysInPeriod;

  // Get category IDs that have budgets
  const budgetedCategoryIds = new Set(budgetRules.map((r) => r.categoryId));

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

  // Total budget for period
  const periodMultiplier = viewMode === 'year' ? 12 : 1;
  const totalBudget = budgetRules.reduce(
    (sum, r) => sum + toMonthlyAmount(r.amountCents, r.cadence) * periodMultiplier,
    0,
  );

  // Actual income received so far
  const actualIncome = allTransactions
    .filter((t) => t.type === 'income' && t.date >= periodStart && t.date <= effectiveDate)
    .reduce((sum, t) => sum + t.amountCents, 0);

  // Actual savings so far
  const actualSavings = allTransactions
    .filter((t) => t.type === 'savings' && t.date >= periodStart && t.date <= effectiveDate)
    .reduce((sum, t) => sum + t.amountCents, 0);

  // Actual expenses - split by budgeted vs unbudgeted
  const expenseTransactionsThisPeriod = allTransactions.filter(
    (t) => t.type === 'expense' && t.date >= periodStart && t.date <= effectiveDate,
  );

  const actualBudgetedExpenses = expenseTransactionsThisPeriod
    .filter((t) => t.categoryId && budgetedCategoryIds.has(t.categoryId))
    .reduce((sum, t) => sum + t.amountCents, 0);

  const actualUnbudgetedExpenses = expenseTransactionsThisPeriod
    .filter((t) => !t.categoryId || !budgetedCategoryIds.has(t.categoryId))
    .reduce((sum, t) => sum + t.amountCents, 0);

  const actualExpenses = actualBudgetedExpenses + actualUnbudgetedExpenses;

  // Unallocated = Income - Budget - Savings
  const unallocated = Math.round(expectedIncome - totalBudget - expectedSavings);

  // Net for period
  const actualNet = actualIncome - actualExpenses - actualSavings;

  // Forecasted remaining
  const forecastedIncome = isFuturePeriod
    ? periodForecasts.filter((f) => f.type === 'income').reduce((sum, f) => sum + f.amountCents, 0)
    : isCurrentPeriod
      ? periodForecasts.filter((f) => f.type === 'income' && f.date > effectiveDate).reduce((sum, f) => sum + f.amountCents, 0)
      : 0;
  const forecastedExpenses = isFuturePeriod
    ? periodForecasts.filter((f) => f.type === 'expense').reduce((sum, f) => sum + f.amountCents, 0)
    : isCurrentPeriod
      ? periodForecasts.filter((f) => f.type === 'expense' && f.date > effectiveDate).reduce((sum, f) => sum + f.amountCents, 0)
      : 0;
  const forecastedSavings = isFuturePeriod
    ? periodForecasts.filter((f) => f.type === 'savings').reduce((sum, f) => sum + f.amountCents, 0)
    : isCurrentPeriod
      ? periodForecasts.filter((f) => f.type === 'savings' && f.date > effectiveDate).reduce((sum, f) => sum + f.amountCents, 0)
      : 0;

  const projectedNet = actualNet + forecastedIncome - forecastedExpenses - forecastedSavings;
  const forecastedNet = forecastedIncome - forecastedExpenses - forecastedSavings;

  return {
    dayOfPeriod,
    daysInPeriod,
    income: { expected: Math.round(expectedIncome), actual: actualIncome },
    budgeted: { expected: Math.round(totalBudget), actual: actualBudgetedExpenses },
    unbudgeted: { unallocated: Math.max(0, unallocated), actual: actualUnbudgetedExpenses },
    savings: { expected: Math.round(expectedSavings), actual: actualSavings },
    expenses: { expected: Math.round(expectedExpenses), actual: actualExpenses },
    net: { projected: projectedNet, forecasted: forecastedNet },
  };
}

/**
 * Calculate budget summary stats
 */
function calculateSummary(
  viewMode: 'month' | 'year',
  selectedYear: number,
  selectedMonthIndex: number,
  periodStart: string,
  effectiveDate: string,
  isCurrentPeriod: boolean,
  budgetRules: BudgetRule[],
  periodForecasts: ExpandedForecast[],
  allTransactions: Transaction[],
): BudgetSummary {
  const daysInPeriod = viewMode === 'year'
    ? (selectedYear % 4 === 0 ? 366 : 365)
    : new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
  const effectiveDateObj = new Date(effectiveDate);
  const dayOfPeriod = isCurrentPeriod
    ? (viewMode === 'year'
      ? Math.ceil((effectiveDateObj.getTime() - new Date(selectedYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24)) + 1
      : effectiveDateObj.getDate())
    : daysInPeriod;
  const periodProgress = dayOfPeriod / daysInPeriod;

  let overCount = 0;
  let overspendingCount = 0;
  let goodCount = 0;

  const periodMultiplier = viewMode === 'year' ? 12 : 1;

  for (const rule of budgetRules) {
    const periodBudget = toMonthlyAmount(rule.amountCents, rule.cadence) * periodMultiplier;

    const spent = allTransactions
      .filter((t) => t.type === 'expense' && t.categoryId === rule.categoryId && t.date >= periodStart && t.date <= effectiveDate)
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
    trackedCount: budgetRules.length,
    totalSavingsForecasted,
  };
}

/**
 * Calculate spending by category
 */
function calculatePeriodSpending(
  viewMode: 'month' | 'year',
  periodStart: string,
  effectiveDate: string,
  budgetRules: BudgetRule[],
  activeCategories: Category[],
  allTransactions: Transaction[],
): PeriodSpending {
  const expenseTransactions = allTransactions.filter(
    (t) => t.type === 'expense' && t.date >= periodStart && t.date <= effectiveDate,
  );

  const periodMultiplier = viewMode === 'year' ? 12 : 1;
  const budgetByCategory = new Map<string, number>();
  for (const rule of budgetRules) {
    budgetByCategory.set(rule.categoryId, Math.round(toMonthlyAmount(rule.amountCents, rule.cadence) * periodMultiplier));
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
    categorySpending.push({ id: 'uncategorized', name: 'Uncategorised', amount: uncategorized, budget: 0 });
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
  viewMode: 'month' | 'year',
  periodStart: string,
  periodEnd: string,
  periodLabel: string,
  budgetRules: BudgetRule[],
  allTransactions: Transaction[],
): BurnRateData {
  const expenses = allTransactions.filter(
    (t) => t.type === 'expense' && t.date >= periodStart && t.date <= periodEnd,
  );

  const dailySpending = expenses.map((t) => ({
    date: t.date,
    amount: t.amountCents,
  }));

  const periodMultiplier = viewMode === 'year' ? 12 : 1;
  const totalBudget = budgetRules.reduce(
    (sum, r) => sum + toMonthlyAmount(r.amountCents, r.cadence) * periodMultiplier,
    0,
  );

  return {
    dailySpending,
    totalBudget: Math.round(totalBudget),
    periodStart,
    periodEnd,
    periodLabel,
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
  const { budgetRules, isLoading: budgetLoading } = useBudgetRules(scenarioId);
  const { activeCategories, isLoading: categoriesLoading } = useCategories();

  // Calculate dates
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const selectedYear = selectedMonth.getFullYear();
  const selectedMonthIndex = selectedMonth.getMonth();

  const periodStart = viewMode === 'year'
    ? `${selectedYear}-01-01`
    : `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
  const periodEnd = viewMode === 'year'
    ? `${selectedYear}-12-31`
    : `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

  const isCurrentPeriod = viewMode === 'year'
    ? today.slice(0, 4) === String(selectedYear)
    : today.slice(0, 7) === periodStart.slice(0, 7);
  const isFuturePeriod = periodStart > today;
  const isPastPeriod = periodEnd < today;
  const effectiveDate = isCurrentPeriod ? today : (isFuturePeriod ? periodStart : periodEnd);

  const shortMonthName = selectedMonth.toLocaleDateString('en-AU', { month: 'long' });
  const periodLabel = viewMode === 'year' ? String(selectedYear) : `${shortMonthName} ${selectedYear}`;

  // Get forecasts for the period
  const { expandedForecasts: periodForecasts, savingsForecasts, isLoading: forecastsLoading } = useForecasts(scenarioId, periodStart, periodEnd);

  const isLoading = transactionsLoading || budgetLoading || categoriesLoading || forecastsLoading;

  // Build color map
  const colorMap = useMemo(() => {
    return buildCategoryColorMap(activeCategories.map((c) => c.id));
  }, [activeCategories]);

  // Calculate all derived data
  const periodCashFlow = useMemo(
    () => calculatePeriodCashFlow(
      viewMode, selectedYear, selectedMonthIndex, periodStart, effectiveDate,
      isCurrentPeriod, isFuturePeriod, budgetRules, periodForecasts, savingsForecasts, allTransactions,
    ),
    [viewMode, selectedYear, selectedMonthIndex, periodStart, effectiveDate, isCurrentPeriod, isFuturePeriod, budgetRules, periodForecasts, savingsForecasts, allTransactions],
  );

  const summary = useMemo(
    () => calculateSummary(
      viewMode, selectedYear, selectedMonthIndex, periodStart, effectiveDate,
      isCurrentPeriod, budgetRules, periodForecasts, allTransactions,
    ),
    [viewMode, selectedYear, selectedMonthIndex, periodStart, effectiveDate, isCurrentPeriod, budgetRules, periodForecasts, allTransactions],
  );

  const periodSpending = useMemo(
    () => calculatePeriodSpending(viewMode, periodStart, effectiveDate, budgetRules, activeCategories, allTransactions),
    [viewMode, periodStart, effectiveDate, budgetRules, activeCategories, allTransactions],
  );

  const forecastExpenses = useMemo(
    () => calculateForecastExpenses(periodForecasts, activeCategories),
    [periodForecasts, activeCategories],
  );

  const burnRateData = useMemo(
    () => calculateBurnRateData(viewMode, periodStart, periodEnd, periodLabel, budgetRules, allTransactions),
    [viewMode, periodStart, periodEnd, periodLabel, budgetRules, allTransactions],
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
