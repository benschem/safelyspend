import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { Target, CircleGauge, PiggyBank, Calendar, TrendingUp, Receipt, CircleAlert, CreditCard, BarChart3, Landmark } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { ScenarioSelector } from '@/components/scenario-selector';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { formatCents } from '@/lib/utils';

interface OutletContext {
  activeScenarioId: string | null;
}

export function BudgetPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { allTransactions } = useTransactions();
  const { budgetRules } = useBudgetRules(activeScenarioId);

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

  if (!activeScenarioId || !activeScenario) {
    return (
      <div>
        <div className="mb-20 flex flex-wrap items-center justify-between gap-4">
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

      {/* Summary Cards - Top Row */}
      <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Income Card */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Income
          </div>
          <p className="mt-2 text-2xl font-bold text-green-600">
            {formatCents(monthlyCashFlow.income.actual)}
          </p>
          <p className="text-xs text-muted-foreground">
            of {formatCents(monthlyCashFlow.income.expected)} expected
          </p>
        </div>

        {/* Budgeted Card */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Receipt className="h-4 w-4" />
            Budgeted Spending
          </div>
          <p className="mt-2 text-2xl font-bold text-red-600">
            {formatCents(monthlyCashFlow.budgeted.actual)}
          </p>
          <p className="text-xs text-muted-foreground">
            of {formatCents(monthlyCashFlow.budgeted.expected)} limit
          </p>
        </div>

        {/* Unallocated Card */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleAlert className="h-4 w-4" />
            Unallocated
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {formatCents(monthlyCashFlow.unbudgeted.actual)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatCents(monthlyCashFlow.unbudgeted.unallocated)} available
          </p>
        </div>

        {/* Savings Card */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PiggyBank className="h-4 w-4" />
            Savings
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {formatCents(monthlyCashFlow.savings.actual)}
          </p>
          <p className="text-xs text-muted-foreground">
            of {formatCents(monthlyCashFlow.savings.expected)} expected
          </p>
        </div>
      </div>

      {/* Main Content: Progress Bars + Stats Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Progress Bars - Left Side */}
        <div className="rounded-lg border p-6">
          <div className="mb-6 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Monthly Progress</h3>
          </div>
          {(() => {
            const ref = Math.max(monthlyCashFlow.income.expected, monthlyCashFlow.income.actual, 1);
            const pct = (val: number) => `${Math.min((val / ref) * 100, 100)}%`;
            return (
              <div className="space-y-5">
                {/* Income bar */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Income</span>
                  </div>
                  <div className="relative h-4 rounded-full bg-muted">
                    <div className="absolute h-4 rounded-full bg-green-500" style={{ width: pct(monthlyCashFlow.income.actual) }} />
                  </div>
                </div>

                {/* Budgeted expenses bar */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium">Budgeted</span>
                  </div>
                  <div className="relative h-4 rounded-full bg-muted">
                    <div className="absolute h-4 rounded-full bg-red-200" style={{ width: pct(monthlyCashFlow.budgeted.expected) }} />
                    <div className="absolute h-4 rounded-full bg-red-500" style={{ width: pct(monthlyCashFlow.budgeted.actual) }} />
                  </div>
                </div>

                {/* Unallocated bar */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CircleAlert className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium">Unallocated</span>
                  </div>
                  <div className="relative h-4 rounded-full bg-muted">
                    <div className="absolute h-4 rounded-full bg-amber-200" style={{ width: pct(monthlyCashFlow.unbudgeted.unallocated) }} />
                    <div className="absolute h-4 rounded-full bg-amber-500" style={{ width: pct(monthlyCashFlow.unbudgeted.actual) }} />
                  </div>
                </div>

                {/* Savings bar */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <PiggyBank className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Savings</span>
                  </div>
                  <div className="relative h-4 rounded-full bg-muted">
                    <div className="absolute h-4 rounded-full bg-blue-200" style={{ width: pct(monthlyCashFlow.savings.expected) }} />
                    <div className="absolute h-4 rounded-full bg-blue-500" style={{ width: pct(monthlyCashFlow.savings.actual) }} />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Stats Cards - Right Side 2x2 Grid */}
        <div className="grid gap-4 grid-cols-2">
          {/* Net for Month */}
          <div className="flex flex-col rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4 text-muted-foreground" />
              Net for {monthName}
            </div>
            <div className="flex-1" />
            <p className={`mt-3 text-xl font-bold ${monthlyCashFlow.net.projected >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {monthlyCashFlow.net.projected >= 0 ? '+' : ''}{formatCents(monthlyCashFlow.net.projected)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {monthlyCashFlow.net.forecasted !== 0 && `Incl. ${formatCents(Math.abs(monthlyCashFlow.net.forecasted))} forecast`}
            </p>
          </div>

          {/* Spending Speed */}
          <Link
            to="/analyse?tab=pace"
            className="flex flex-col rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <CircleGauge className="h-4 w-4 text-muted-foreground" />
              Spending Speed
            </div>
            <div className="flex-1" />
            {summary.overCount > 0 ? (
              <p className="mt-3 text-xl font-bold text-red-600">Too Fast</p>
            ) : summary.overspendingCount > 0 ? (
              <p className="mt-3 text-xl font-bold text-amber-600">Speeding Up</p>
            ) : (
              <p className="mt-3 text-xl font-bold text-green-600">On Track</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.overCount > 0
                ? `${summary.overCount} exceeded`
                : summary.overspendingCount > 0
                  ? `${summary.overspendingCount} overspending`
                  : `${summary.goodCount} on pace`}
            </p>
          </Link>

          {/* Placeholder - Coming Soon */}
          <div className="flex flex-col rounded-lg border p-4 opacity-60">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Debt Payments
            </div>
            <div className="flex-1" />
            <p className="mt-3 text-xl font-bold text-muted-foreground">—</p>
            <p className="mt-1 text-xs text-muted-foreground">Coming soon</p>
          </div>

          {/* Investments - Coming Soon */}
          <div className="flex flex-col rounded-lg border p-4 opacity-60">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              Investments
            </div>
            <div className="flex-1" />
            <p className="mt-3 text-xl font-bold text-muted-foreground">—</p>
            <p className="mt-1 text-xs text-muted-foreground">Coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
