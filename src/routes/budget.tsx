import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { CircleGauge, PiggyBank, Calendar, TrendingUp, Receipt, CircleAlert, ArrowRight, Tags } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { ScenarioSelector } from '@/components/scenario-selector';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { buildCategoryColorMap, CHART_COLORS } from '@/lib/chart-colors';
import { formatCents } from '@/lib/utils';

interface OutletContext {
  activeScenarioId: string | null;
}

export function BudgetPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { allTransactions } = useTransactions();
  const { budgetRules } = useBudgetRules(activeScenarioId);
  const { activeCategories } = useCategories();

  // Get monthly date range
  const today = new Date().toISOString().slice(0, 10);
  const thisMonthStart = today.slice(0, 7) + '-01';
  const thisMonthEndDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
  const { expandedForecasts: monthForecasts } = useForecasts(activeScenarioId, thisMonthStart, thisMonthEndDate);

  const monthName = new Date().toLocaleDateString('en-AU', { month: 'long' });

  // Monthly cash flow calculation
  const monthlyCashFlow = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();

    // Get category IDs that have budgets
    const budgetedCategoryIds = new Set(budgetRules.map((r) => r.categoryId));

    // Expected income for full month
    const expectedIncome = monthForecasts
      .filter((f) => f.type === 'income')
      .reduce((sum, f) => sum + f.amountCents, 0);

    // Expected savings for full month
    const expectedSavings = monthForecasts
      .filter((f) => f.type === 'savings')
      .reduce((sum, f) => sum + f.amountCents, 0);

    // Expected expenses for full month
    const expectedExpenses = monthForecasts
      .filter((f) => f.type === 'expense')
      .reduce((sum, f) => sum + f.amountCents, 0);

    // Total budget for month (sum of all budget rules, converted to monthly)
    const totalBudget = budgetRules.reduce((sum, r) => {
      switch (r.cadence) {
        case 'weekly':
          return sum + r.amountCents * 4.33;
        case 'fortnightly':
          return sum + r.amountCents * 2.17;
        case 'monthly':
          return sum + r.amountCents;
        case 'quarterly':
          return sum + r.amountCents / 3;
        case 'yearly':
          return sum + r.amountCents / 12;
        default:
          return sum + r.amountCents;
      }
    }, 0);

    // Actual income received so far
    const actualIncome = allTransactions
      .filter((t) => t.type === 'income' && t.date >= thisMonthStart && t.date <= today)
      .reduce((sum, t) => sum + t.amountCents, 0);

    // Actual savings so far
    const actualSavings = allTransactions
      .filter((t) => t.type === 'savings' && t.date >= thisMonthStart && t.date <= today)
      .reduce((sum, t) => sum + t.amountCents, 0);

    // Actual expenses - split by budgeted vs unbudgeted
    const expenseTransactionsThisMonth = allTransactions.filter(
      (t) => t.type === 'expense' && t.date >= thisMonthStart && t.date <= today
    );

    const actualBudgetedExpenses = expenseTransactionsThisMonth
      .filter((t) => t.categoryId && budgetedCategoryIds.has(t.categoryId))
      .reduce((sum, t) => sum + t.amountCents, 0);

    const actualUnbudgetedExpenses = expenseTransactionsThisMonth
      .filter((t) => !t.categoryId || !budgetedCategoryIds.has(t.categoryId))
      .reduce((sum, t) => sum + t.amountCents, 0);

    const actualExpenses = actualBudgetedExpenses + actualUnbudgetedExpenses;

    // Unallocated = Income - Budget - Savings
    const unallocated = Math.round(expectedIncome - totalBudget - expectedSavings);

    // Net for month = Income - Expenses - Savings (actual so far)
    const actualNet = actualIncome - actualExpenses - actualSavings;

    // Forecasted remaining income/expenses/savings for the rest of the month
    const forecastedIncome = monthForecasts
      .filter((f) => f.type === 'income' && f.date > today)
      .reduce((sum, f) => sum + f.amountCents, 0);
    const forecastedExpenses = monthForecasts
      .filter((f) => f.type === 'expense' && f.date > today)
      .reduce((sum, f) => sum + f.amountCents, 0);
    const forecastedSavings = monthForecasts
      .filter((f) => f.type === 'savings' && f.date > today)
      .reduce((sum, f) => sum + f.amountCents, 0);

    // Projected net for full month
    const projectedNet = actualNet + forecastedIncome - forecastedExpenses - forecastedSavings;
    const forecastedNet = forecastedIncome - forecastedExpenses - forecastedSavings;

    return {
      dayOfMonth,
      daysInMonth,
      income: { expected: Math.round(expectedIncome), actual: actualIncome },
      budgeted: { expected: Math.round(totalBudget), actual: actualBudgetedExpenses },
      unbudgeted: { unallocated: Math.max(0, unallocated), actual: actualUnbudgetedExpenses },
      savings: { expected: Math.round(expectedSavings), actual: actualSavings },
      expenses: { expected: Math.round(expectedExpenses), actual: actualExpenses },
      net: {
        projected: projectedNet,
        forecasted: forecastedNet,
      },
    };
  }, [monthForecasts, budgetRules, allTransactions, thisMonthStart, today]);

  // Summary stats for the cards
  const summary = useMemo(() => {
    // Calculate spending pace stats
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const periodProgress = dayOfMonth / daysInMonth;

    let overCount = 0;
    let overspendingCount = 0;
    let goodCount = 0;

    for (const rule of budgetRules) {
      // Convert to monthly for comparison
      let monthlyBudget = rule.amountCents;
      switch (rule.cadence) {
        case 'weekly':
          monthlyBudget = rule.amountCents * 4.33;
          break;
        case 'fortnightly':
          monthlyBudget = rule.amountCents * 2.17;
          break;
        case 'quarterly':
          monthlyBudget = rule.amountCents / 3;
          break;
        case 'yearly':
          monthlyBudget = rule.amountCents / 12;
          break;
      }

      const spent = allTransactions
        .filter((t) => t.type === 'expense' && t.categoryId === rule.categoryId && t.date >= thisMonthStart && t.date <= today)
        .reduce((sum, t) => sum + t.amountCents, 0);

      const spentPercent = monthlyBudget > 0 ? spent / monthlyBudget : 0;
      const expectedSpend = monthlyBudget * periodProgress;
      const burnRate = expectedSpend > 0 ? spent / expectedSpend : 0;

      if (spentPercent >= 1) {
        overCount++;
      } else if (burnRate > 1.2) {
        overspendingCount++;
      } else {
        goodCount++;
      }
    }

    // Savings forecasted
    const totalSavingsForecasted = monthForecasts
      .filter((f) => f.type === 'savings')
      .reduce((sum, f) => sum + f.amountCents, 0);

    return {
      overCount,
      overspendingCount,
      goodCount,
      trackedCount: budgetRules.length,
      totalSavingsForecasted,
    };
  }, [budgetRules, allTransactions, monthForecasts, thisMonthStart, today]);

  // Calculate this month's spending by category for horizontal bar chart
  const thisMonthSpending = useMemo(() => {
    const expenseTransactions = allTransactions.filter(
      (t) => t.type === 'expense' && t.date >= thisMonthStart && t.date <= today
    );

    // Build budget lookup (converted to monthly amounts)
    const budgetByCategory = new Map<string, number>();
    for (const rule of budgetRules) {
      let monthlyBudget = rule.amountCents;
      switch (rule.cadence) {
        case 'weekly':
          monthlyBudget = rule.amountCents * 4.33;
          break;
        case 'fortnightly':
          monthlyBudget = rule.amountCents * 2.17;
          break;
        case 'quarterly':
          monthlyBudget = rule.amountCents / 3;
          break;
        case 'yearly':
          monthlyBudget = rule.amountCents / 12;
          break;
      }
      budgetByCategory.set(rule.categoryId, Math.round(monthlyBudget));
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
  }, [allTransactions, activeCategories, budgetRules, thisMonthStart, today]);

  // Build color map for spending chart
  const colorMap = useMemo(() => {
    const categoryIds = activeCategories.map((c) => c.id);
    return buildCategoryColorMap(categoryIds);
  }, [activeCategories]);

  if (!activeScenarioId || !activeScenario) {
    return (
      <div>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold">
              <Calendar className="h-7 w-7" />
              {monthName}
            </h1>
            <p className="mt-1 text-muted-foreground">Day {new Date().getDate()} of {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}</p>
          </div>
          <ScenarioSelector />
        </div>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Select a scenario to track your budget.</p>
          <Button asChild className="mt-4">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header - Month name pulled out */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Calendar className="h-7 w-7" />
            {monthName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Day {monthlyCashFlow.dayOfMonth} of {monthlyCashFlow.daysInMonth}
          </p>
        </div>
        <ScenarioSelector />
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Income */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Income</p>
          <p className="mt-1 text-xl font-semibold">{formatCents(monthlyCashFlow.income.actual)}</p>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>of {formatCents(monthlyCashFlow.income.expected)} forecast</span>
              <span>{monthlyCashFlow.income.expected > 0 ? Math.round((monthlyCashFlow.income.actual / monthlyCashFlow.income.expected) * 100) : 0}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-green-500/20">
              <div
                className="h-1.5 rounded-full bg-green-500"
                style={{ width: `${Math.min((monthlyCashFlow.income.actual / Math.max(monthlyCashFlow.income.expected, 1)) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Budgeted Spending */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
            <Receipt className="h-5 w-5 text-red-500" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Budgeted</p>
          <p className="mt-1 text-xl font-semibold">{formatCents(monthlyCashFlow.budgeted.actual)}</p>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>of {formatCents(monthlyCashFlow.budgeted.expected)}</span>
              <span>{monthlyCashFlow.budgeted.expected > 0 ? Math.round((monthlyCashFlow.budgeted.actual / monthlyCashFlow.budgeted.expected) * 100) : 0}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-red-500/20">
              <div
                className="h-1.5 rounded-full bg-red-500"
                style={{ width: `${Math.min((monthlyCashFlow.budgeted.actual / Math.max(monthlyCashFlow.budgeted.expected, 1)) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Unallocated Spending */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
            <CircleAlert className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Unallocated</p>
          <p className="mt-1 text-xl font-semibold">{formatCents(monthlyCashFlow.unbudgeted.actual)}</p>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>of {formatCents(monthlyCashFlow.unbudgeted.unallocated)}</span>
              <span>{monthlyCashFlow.unbudgeted.unallocated > 0 ? Math.round((monthlyCashFlow.unbudgeted.actual / monthlyCashFlow.unbudgeted.unallocated) * 100) : 0}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-amber-500/20">
              <div
                className="h-1.5 rounded-full bg-amber-500"
                style={{ width: `${Math.min((monthlyCashFlow.unbudgeted.actual / Math.max(monthlyCashFlow.unbudgeted.unallocated, 1)) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Savings */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
            <PiggyBank className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Savings</p>
          <p className="mt-1 text-xl font-semibold">{formatCents(monthlyCashFlow.savings.actual)}</p>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>of {formatCents(monthlyCashFlow.savings.expected)}</span>
              <span>{monthlyCashFlow.savings.expected > 0 ? Math.round((monthlyCashFlow.savings.actual / monthlyCashFlow.savings.expected) * 100) : 0}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-blue-500/20">
              <div
                className="h-1.5 rounded-full bg-blue-500"
                style={{ width: `${Math.min((monthlyCashFlow.savings.actual / Math.max(monthlyCashFlow.savings.expected, 1)) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Net & Speed Row */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        {/* Net Change */}
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Projected net change</p>
          <p className={`mt-2 text-3xl font-bold ${monthlyCashFlow.net.projected >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {monthlyCashFlow.net.projected >= 0 ? '+' : ''}{formatCents(monthlyCashFlow.net.projected)}
          </p>
          {monthlyCashFlow.net.forecasted !== 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Includes {formatCents(Math.abs(monthlyCashFlow.net.forecasted))} forecasted
            </p>
          )}
        </div>

        {/* Spending Speed */}
        <Link
          to="/analyse?tab=pace"
          className="group rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Spending speed</p>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            {summary.overCount > 0 ? (
              <>
                <CircleGauge className="h-7 w-7 text-red-500" />
                <span className="text-3xl font-bold text-red-600">Too Fast</span>
              </>
            ) : summary.overspendingCount > 0 ? (
              <>
                <CircleGauge className="h-7 w-7 text-amber-500" />
                <span className="text-3xl font-bold text-amber-600">Speeding Up</span>
              </>
            ) : (
              <>
                <CircleGauge className="h-7 w-7 text-green-500" />
                <span className="text-3xl font-bold text-green-600">On Track</span>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {summary.overCount > 0
              ? `${summary.overCount} of ${summary.trackedCount} budgets exceeded`
              : summary.overspendingCount > 0
                ? `${summary.overspendingCount} of ${summary.trackedCount} budgets overspending`
                : `${summary.goodCount} of ${summary.trackedCount} budgets on pace`}
          </p>
        </Link>
      </div>

      {/* Monthly Spending by Category - Horizontal Bar Chart */}
      <div className="mt-6 rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Spending</h3>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{formatCents(thisMonthSpending.total)}</p>
            <p className="text-xs text-muted-foreground">
              {thisMonthSpending.categorySpending.length} {thisMonthSpending.categorySpending.length === 1 ? 'category' : 'categories'}
            </p>
          </div>
        </div>

        {thisMonthSpending.categorySpending.length === 0 ? (
          <div className="mt-6 flex h-24 items-center justify-center text-sm text-muted-foreground">
            No expenses recorded this month.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {thisMonthSpending.categorySpending.map((item) => {
              const color = colorMap[item.id] ?? CHART_COLORS.uncategorized;
              const hasBudget = item.budget > 0;
              // Percentage of budget spent (capped at 100% for display)
              const spentPercent = hasBudget ? Math.min((item.amount / item.budget) * 100, 100) : 100;
              const isOverBudget = hasBudget && item.amount > item.budget;

              return (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="font-mono text-muted-foreground">
                      {formatCents(item.amount)}
                      {hasBudget && (
                        <span className="text-xs"> / {formatCents(item.budget)}</span>
                      )}
                    </span>
                  </div>
                  <div className="relative h-3 rounded-full bg-muted">
                    {/* Light bar: budget amount (full width if budgeted) */}
                    {hasBudget && (
                      <div
                        className="absolute h-3 rounded-full"
                        style={{
                          width: '100%',
                          backgroundColor: color,
                          opacity: 0.25,
                        }}
                      />
                    )}
                    {/* Dark bar: actual spending relative to budget */}
                    <div
                      className={`absolute h-3 rounded-full ${isOverBudget ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                      style={{
                        width: `${spentPercent}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
