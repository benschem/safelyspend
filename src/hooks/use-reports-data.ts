import { useMemo } from 'react';
import { useTransactions } from './use-transactions';
import { useBudgetRules } from './use-budget-rules';
import { useSavingsGoals } from './use-savings-goals';
import { useCategories } from './use-categories';
import { useForecasts } from './use-forecasts';
import { getMonthsBetween } from '@/lib/utils';
import type { Category, Cadence } from '@/lib/types';

export interface MonthlySpending {
  month: string; // YYYY-MM
  categories: Record<string, { actual: number; forecast: number }>; // categoryId -> amounts
  uncategorized: { actual: number; forecast: number };
  total: { actual: number; forecast: number };
}

export interface BudgetComparison {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  actual: number;
  variance: number; // positive = under budget
}

export interface MonthlyBudgetComparison {
  month: string;
  categories: Record<string, { budgeted: number; actual: number }>;
}

export interface MonthlyNetFlow {
  month: string;
  income: { actual: number; forecast: number };
  expenses: { actual: number; forecast: number };
  savings: { actual: number; forecast: number };
  interest: number; // Interest earned (included in total saved, not savings line)
  net: { actual: number; forecast: number };
}

export interface SavingsProgressItem {
  goalId: string;
  goalName: string;
  targetAmount: number;
  savedAmount: number;
  percentComplete: number;
  deadline: string | undefined;
}

export interface MonthlySavingsItem {
  month: string;
  actual: number;
  forecast: number;
  cumulativeActual: number;
  cumulativeForecast: number;
}

export interface GoalMonthlySavings {
  goalId: string;
  goalName: string;
  targetAmount: number;
  currentBalance: number; // All-time saved amount
  startingBalance: number; // Balance at start of date range (for chart calculations)
  deadline: string | undefined;
  annualInterestRate: number | undefined;
  monthlySavings: MonthlySavingsItem[];
}

/**
 * Hook for computing report data
 */
/**
 * Calculate budget amount for a single month based on cadence
 */
function getBudgetForMonth(
  amountCents: number,
  cadence: Cadence,
  month: string,
): number {
  const [year, m] = month.split('-').map(Number);
  const monthStart = `${month}-01`;
  const lastDay = new Date(year!, m!, 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

  const start = new Date(monthStart);
  const end = new Date(monthEnd);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  switch (cadence) {
    case 'weekly':
      return amountCents * Math.ceil(diffDays / 7);
    case 'fortnightly':
      return amountCents * Math.ceil(diffDays / 14);
    case 'monthly':
      return amountCents;
    case 'quarterly':
      // Only count if it's a quarter start month (Jan, Apr, Jul, Oct)
      return (m! - 1) % 3 === 0 ? amountCents : 0;
    case 'yearly':
      // Only count in January
      return m === 1 ? amountCents : 0;
  }
}

export function useReportsData(
  scenarioId: string | null,
  startDate: string,
  endDate: string,
) {
  const { incomeTransactions, expenseTransactions, savingsTransactions } =
    useTransactions(startDate, endDate);
  const { expandedBudgets, budgetRules } = useBudgetRules(scenarioId, startDate, endDate);
  const { savingsGoals } = useSavingsGoals();
  const { categories, activeCategories } = useCategories();
  const { incomeForecasts, expenseForecasts, savingsForecasts } = useForecasts(scenarioId, startDate, endDate);

  // Separate savings forecasts into contributions and interest
  // Interest is shown as "actual" (earned money) not forecast in charts
  const savingsContributions = useMemo(
    () => savingsForecasts.filter((f) => f.sourceType !== 'interest'),
    [savingsForecasts],
  );
  const interestForecasts = useMemo(
    () => savingsForecasts.filter((f) => f.sourceType === 'interest'),
    [savingsForecasts],
  );

  // Get category lookup map
  const categoryMap = useMemo(() => {
    const map: Record<string, Category> = {};
    for (const cat of categories) {
      map[cat.id] = cat;
    }
    return map;
  }, [categories]);

  // Monthly spending by category (actual + forecast)
  const monthlySpending = useMemo((): MonthlySpending[] => {
    const months = getMonthsBetween(startDate, endDate);
    const today = new Date().toISOString().slice(0, 10);
    const result: MonthlySpending[] = [];

    for (const month of months) {
      const monthStart = `${month}-01`;
      const [year, m] = month.split('-').map(Number);
      const lastDay = new Date(year!, m!, 0).getDate();
      const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

      // Actual expenses from transactions
      const monthExpenses = expenseTransactions.filter(
        (t) => t.date >= monthStart && t.date <= monthEnd,
      );

      // Forecasted expenses (only future dates)
      const monthForecasts = expenseForecasts.filter(
        (f) => f.date >= monthStart && f.date <= monthEnd && f.date > today,
      );

      const categories: Record<string, { actual: number; forecast: number }> = {};
      let uncategorizedActual = 0;
      let uncategorizedForecast = 0;

      // Process actual transactions
      for (const tx of monthExpenses) {
        if (tx.categoryId) {
          if (!categories[tx.categoryId]) {
            categories[tx.categoryId] = { actual: 0, forecast: 0 };
          }
          categories[tx.categoryId]!.actual += tx.amountCents;
        } else {
          uncategorizedActual += tx.amountCents;
        }
      }

      // Process forecasts
      for (const f of monthForecasts) {
        if (f.categoryId) {
          if (!categories[f.categoryId]) {
            categories[f.categoryId] = { actual: 0, forecast: 0 };
          }
          categories[f.categoryId]!.forecast += f.amountCents;
        } else {
          uncategorizedForecast += f.amountCents;
        }
      }

      const totalActual = Object.values(categories).reduce((sum, v) => sum + v.actual, 0) + uncategorizedActual;
      const totalForecast = Object.values(categories).reduce((sum, v) => sum + v.forecast, 0) + uncategorizedForecast;

      result.push({
        month,
        categories,
        uncategorized: { actual: uncategorizedActual, forecast: uncategorizedForecast },
        total: { actual: totalActual, forecast: totalForecast },
      });
    }

    return result;
  }, [startDate, endDate, expenseTransactions, expenseForecasts]);

  // Budget vs actual comparison
  const budgetComparison = useMemo((): BudgetComparison[] => {
    const spendingByCategory: Record<string, number> = {};

    for (const tx of expenseTransactions) {
      if (tx.categoryId) {
        spendingByCategory[tx.categoryId] =
          (spendingByCategory[tx.categoryId] ?? 0) + tx.amountCents;
      }
    }

    const result: BudgetComparison[] = [];

    for (const category of activeCategories) {
      const budgeted = expandedBudgets[category.id] ?? 0;
      const actual = spendingByCategory[category.id] ?? 0;

      // Only include categories with budget or spending
      if (budgeted > 0 || actual > 0) {
        result.push({
          categoryId: category.id,
          categoryName: category.name,
          budgeted,
          actual,
          variance: budgeted - actual,
        });
      }
    }

    // Sort by variance (most over budget first)
    result.sort((a, b) => a.variance - b.variance);

    return result;
  }, [activeCategories, expandedBudgets, expenseTransactions]);

  // Monthly budget vs actual per category (includes forecasts for future dates)
  const monthlyBudgetComparison = useMemo((): MonthlyBudgetComparison[] => {
    const months = getMonthsBetween(startDate, endDate);
    const today = new Date().toISOString().slice(0, 10);
    const result: MonthlyBudgetComparison[] = [];

    for (const month of months) {
      const monthStart = `${month}-01`;
      const [year, m] = month.split('-').map(Number);
      const lastDay = new Date(year!, m!, 0).getDate();
      const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

      const categories: Record<string, { budgeted: number; actual: number }> = {};

      // Calculate actual spending per category for this month (from transactions)
      const monthExpenses = expenseTransactions.filter(
        (t) => t.date >= monthStart && t.date <= monthEnd,
      );

      for (const tx of monthExpenses) {
        if (tx.categoryId) {
          if (!categories[tx.categoryId]) {
            categories[tx.categoryId] = { budgeted: 0, actual: 0 };
          }
          categories[tx.categoryId]!.actual += tx.amountCents;
        }
      }

      // Add forecast spending for future dates
      const monthForecasts = expenseForecasts.filter(
        (f) => f.date >= monthStart && f.date <= monthEnd && f.date > today,
      );

      for (const forecast of monthForecasts) {
        if (forecast.categoryId) {
          if (!categories[forecast.categoryId]) {
            categories[forecast.categoryId] = { budgeted: 0, actual: 0 };
          }
          categories[forecast.categoryId]!.actual += forecast.amountCents;
        }
      }

      // Calculate budget per category for this month
      for (const rule of budgetRules) {
        const budgetAmount = getBudgetForMonth(rule.amountCents, rule.cadence, month);
        if (!categories[rule.categoryId]) {
          categories[rule.categoryId] = { budgeted: 0, actual: 0 };
        }
        categories[rule.categoryId]!.budgeted = budgetAmount;
      }

      result.push({ month, categories });
    }

    return result;
  }, [startDate, endDate, expenseTransactions, expenseForecasts, budgetRules]);

  // Get categories used in budget comparison (have budget or spending)
  const budgetCategories = useMemo(() => {
    const categoryIds = new Set<string>();
    for (const mbc of monthlyBudgetComparison) {
      for (const catId of Object.keys(mbc.categories)) {
        const data = mbc.categories[catId];
        if (data && (data.budgeted > 0 || data.actual > 0)) {
          categoryIds.add(catId);
        }
      }
    }
    return Array.from(categoryIds)
      .map((id) => categoryMap[id])
      .filter((c): c is Category => c !== undefined);
  }, [monthlyBudgetComparison, categoryMap]);

  // Monthly income vs expenses
  const monthlyNetFlow = useMemo((): MonthlyNetFlow[] => {
    const months = getMonthsBetween(startDate, endDate);
    const today = new Date().toISOString().slice(0, 10);
    const result: MonthlyNetFlow[] = [];

    for (const month of months) {
      const monthStart = `${month}-01`;
      const [year, m] = month.split('-').map(Number);
      const lastDay = new Date(year!, m!, 0).getDate();
      const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

      // Actual from transactions
      const incomeActual = incomeTransactions
        .filter((t) => t.date >= monthStart && t.date <= monthEnd)
        .reduce((sum, t) => sum + t.amountCents, 0);

      const expensesActual = expenseTransactions
        .filter((t) => t.date >= monthStart && t.date <= monthEnd)
        .reduce((sum, t) => sum + t.amountCents, 0);

      const savingsActual = savingsTransactions
        .filter((t) => t.date >= monthStart && t.date <= monthEnd)
        .reduce((sum, t) => sum + t.amountCents, 0);

      // Forecasted contributions (only future dates, excluding interest)
      const incomeForecast = incomeForecasts
        .filter((f) => f.date >= monthStart && f.date <= monthEnd && f.date > today)
        .reduce((sum, f) => sum + f.amountCents, 0);

      const expensesForecast = expenseForecasts
        .filter((f) => f.date >= monthStart && f.date <= monthEnd && f.date > today)
        .reduce((sum, f) => sum + f.amountCents, 0);

      // Savings forecast = contributions only (not interest)
      const savingsForecast = savingsContributions
        .filter((f) => f.date >= monthStart && f.date <= monthEnd && f.date > today)
        .reduce((sum, f) => sum + f.amountCents, 0);

      // Interest for this month (included in total saved, but not savings line)
      const interest = interestForecasts
        .filter((f) => f.date >= monthStart && f.date <= monthEnd)
        .reduce((sum, f) => sum + f.amountCents, 0);

      const netActual = incomeActual - expensesActual - savingsActual;
      const netForecast = incomeForecast - expensesForecast - savingsForecast;

      result.push({
        month,
        income: { actual: incomeActual, forecast: incomeForecast },
        expenses: { actual: expensesActual, forecast: expensesForecast },
        savings: { actual: savingsActual, forecast: savingsForecast },
        interest,
        net: { actual: netActual, forecast: netForecast },
      });
    }

    return result;
  }, [startDate, endDate, incomeTransactions, expenseTransactions, savingsTransactions, incomeForecasts, expenseForecasts, savingsContributions, interestForecasts]);

  // Savings goal progress (uses all-time savings, not just date range)
  const { allTransactions } = useTransactions();
  const savingsProgress = useMemo((): SavingsProgressItem[] => {
    const allSavings = allTransactions.filter((t) => t.type === 'savings');

    return savingsGoals.map((goal) => {
      const savedAmount = allSavings
        .filter((t) => t.savingsGoalId === goal.id)
        .reduce((sum, t) => sum + t.amountCents, 0);

      const percentComplete =
        goal.targetAmountCents > 0
          ? Math.min(100, (savedAmount / goal.targetAmountCents) * 100)
          : 0;

      return {
        goalId: goal.id,
        goalName: goal.name,
        targetAmount: goal.targetAmountCents,
        savedAmount,
        percentComplete,
        deadline: goal.deadline,
      };
    });
  }, [savingsGoals, allTransactions]);

  // Monthly savings contributions over time (actual + forecast)
  // Interest is treated as "actual" since it's earned money on existing balances
  const monthlySavings = useMemo((): MonthlySavingsItem[] => {
    const months = getMonthsBetween(startDate, endDate);
    const today = new Date().toISOString().slice(0, 10);
    const result: MonthlySavingsItem[] = [];
    let cumulativeActual = 0;
    let cumulativeForecast = 0;

    for (const month of months) {
      const monthStart = `${month}-01`;
      const [year, m] = month.split('-').map(Number);
      const lastDay = new Date(year!, m!, 0).getDate();
      const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

      // Actual savings from transactions
      const transactionActual = savingsTransactions
        .filter((t) => t.date >= monthStart && t.date <= monthEnd)
        .reduce((sum, t) => sum + t.amountCents, 0);

      // Interest earned (treated as actual - it's earned money on existing balance)
      const interest = interestForecasts
        .filter((f) => f.date >= monthStart && f.date <= monthEnd)
        .reduce((sum, f) => sum + f.amountCents, 0);

      const actual = transactionActual + interest;

      // Forecasted contributions only (only future dates, excluding interest)
      const forecast = savingsContributions
        .filter((f) => f.date >= monthStart && f.date <= monthEnd && f.date > today)
        .reduce((sum, f) => sum + f.amountCents, 0);

      cumulativeActual += actual;
      cumulativeForecast += forecast;

      result.push({
        month,
        actual,
        forecast,
        cumulativeActual,
        cumulativeForecast,
      });
    }

    return result;
  }, [startDate, endDate, savingsTransactions, savingsContributions, interestForecasts]);

  // Per-goal monthly savings (interest treated as actual)
  const savingsByGoal = useMemo((): GoalMonthlySavings[] => {
    const months = getMonthsBetween(startDate, endDate);
    const today = new Date().toISOString().slice(0, 10);

    // Calculate all-time balance per goal
    const allSavings = allTransactions.filter((t) => t.type === 'savings');

    return savingsGoals.map((goal) => {
      const goalTransactions = savingsTransactions.filter((t) => t.savingsGoalId === goal.id);
      const goalContributions = savingsContributions.filter((f) => f.savingsGoalId === goal.id);
      const goalInterest = interestForecasts.filter((f) => f.savingsGoalId === goal.id);

      // All-time saved amount for this goal
      const currentBalance = allSavings
        .filter((t) => t.savingsGoalId === goal.id)
        .reduce((sum, t) => sum + t.amountCents, 0);

      // Transactions within the date range for this goal
      const transactionsInRange = goalTransactions.reduce((sum, t) => sum + t.amountCents, 0);

      // Balance at start of the date range (what was saved before the range)
      const startingBalance = currentBalance - transactionsInRange;

      let cumulativeActual = 0;
      let cumulativeForecast = 0;

      const monthlySavingsData: MonthlySavingsItem[] = months.map((month) => {
        const monthStart = `${month}-01`;
        const [year, m] = month.split('-').map(Number);
        const lastDay = new Date(year!, m!, 0).getDate();
        const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

        // Transactions + interest = actual
        const transactionActual = goalTransactions
          .filter((t) => t.date >= monthStart && t.date <= monthEnd)
          .reduce((sum, t) => sum + t.amountCents, 0);

        const interest = goalInterest
          .filter((f) => f.date >= monthStart && f.date <= monthEnd)
          .reduce((sum, f) => sum + f.amountCents, 0);

        const actual = transactionActual + interest;

        // Contributions only = forecast
        const forecast = goalContributions
          .filter((f) => f.date >= monthStart && f.date <= monthEnd && f.date > today)
          .reduce((sum, f) => sum + f.amountCents, 0);

        cumulativeActual += actual;
        cumulativeForecast += forecast;

        return {
          month,
          actual,
          forecast,
          cumulativeActual,
          cumulativeForecast,
        };
      });

      return {
        goalId: goal.id,
        goalName: goal.name,
        targetAmount: goal.targetAmountCents,
        currentBalance,
        startingBalance,
        deadline: goal.deadline,
        annualInterestRate: goal.annualInterestRate,
        monthlySavings: monthlySavingsData,
      };
    });
  }, [startDate, endDate, savingsGoals, savingsTransactions, savingsContributions, interestForecasts, allTransactions]);

  // Get unique categories used in monthly spending for legend
  const usedCategories = useMemo(() => {
    const categoryIds = new Set<string>();
    for (const ms of monthlySpending) {
      for (const catId of Object.keys(ms.categories)) {
        categoryIds.add(catId);
      }
    }
    return Array.from(categoryIds)
      .map((id) => categoryMap[id])
      .filter((c): c is Category => c !== undefined);
  }, [monthlySpending, categoryMap]);

  return {
    monthlySpending,
    budgetComparison,
    monthlyBudgetComparison,
    budgetCategories,
    monthlyNetFlow,
    savingsProgress,
    monthlySavings,
    savingsByGoal,
    usedCategories,
    categoryMap,
  };
}
