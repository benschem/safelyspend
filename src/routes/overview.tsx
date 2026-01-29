import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Eye,
  Landmark,
  Wallet,
  Receipt,
  CircleAlert,
  CreditCard,
  BarChart3,
  Scale,
} from 'lucide-react';
import { CHART_COLORS, buildCategoryColorMap } from '@/lib/chart-colors';
import { useScenarios } from '@/hooks/use-scenarios';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { ScenarioSelector } from '@/components/scenario-selector';
import { formatCents, formatDate } from '@/lib/utils';

interface OutletContext {
  activeScenarioId: string | null;
}

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { id: string; name: string; amount: number };
  }>;
}

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0]!;
  return (
    <div className="rounded-lg border bg-background p-2 shadow-md">
      <p className="font-medium">{item.name}</p>
      <p className="font-mono text-sm">{formatCents(item.value)}</p>
    </div>
  );
}

export function OverviewPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { activeCategories } = useCategories();
  const { getActiveAnchor } = useBalanceAnchors();

  // Fixed date ranges - no user selection
  const today = new Date().toISOString().slice(0, 10);

  // This month's date range (needed before budget rules hook)
  const thisMonthStart = today.slice(0, 7) + '-01';
  const thisMonthEnd = today;

  // Get budget rules (without date range to get raw rules)
  const { budgetRules } = useBudgetRules(activeScenarioId);

  // Upcoming forecasts: next 14 days
  const fourteenDaysFromNow = new Date();
  fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
  const upcomingEnd = fourteenDaysFromNow.toISOString().slice(0, 10);

  // Current year date range
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  // Get transactions for this month (for spending summary)
  const { allTransactions, expenseTransactions } = useTransactions(thisMonthStart, thisMonthEnd);

  // Get transactions for the full year
  const { allTransactions: yearTransactions } = useTransactions(yearStart, today);

  // Calculate total savings (all time)
  const totalSavings = useMemo(() => {
    return allTransactions
      .filter((t) => t.type === 'savings')
      .reduce((sum, t) => sum + t.amountCents, 0);
  }, [allTransactions]);

  // Get emergency fund and calculate its balance
  const { emergencyFund } = useSavingsGoals();
  const emergencyFundBalance = useMemo(() => {
    if (!emergencyFund) return null;
    return allTransactions
      .filter((t) => t.type === 'savings' && t.savingsGoalId === emergencyFund.id)
      .reduce((sum, t) => sum + t.amountCents, 0);
  }, [emergencyFund, allTransactions]);

  // Get forecasts for upcoming period (14 days)
  const { expandedForecasts } = useForecasts(activeScenarioId, today, upcomingEnd);

  // Get forecasts for the full year
  const { expandedForecasts: yearlyForecasts } = useForecasts(activeScenarioId, yearStart, yearEnd);

  // Get the active anchor for current balance calculation
  const activeAnchor = getActiveAnchor(today);

  // Calculate current balance using anchor-based approach
  const currentBalance = useMemo(() => {
    if (!activeAnchor) return null;

    // We need all transactions from anchor date to today for balance calc
    // Filter allTransactions to those from anchor onwards
    const transactionsFromAnchor = allTransactions.filter(
      (t) => t.date >= activeAnchor.date && t.date <= today,
    );

    let balance = activeAnchor.balanceCents;
    for (const t of transactionsFromAnchor) {
      if (t.type === 'income' || t.type === 'adjustment') {
        balance += t.amountCents;
      } else {
        balance -= t.amountCents;
      }
    }
    return balance;
  }, [activeAnchor, allTransactions, today]);

  const hasNoAnchor = !activeAnchor;

  // Calculate this month's spending by category
  const thisMonthSpending = useMemo(() => {
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
      .map((c) => ({ id: c.id, name: c.name, amount: byCategory[c.id] ?? 0 }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    if (uncategorized > 0) {
      categorySpending.push({ id: 'uncategorized', name: 'Uncategorised', amount: uncategorized });
    }

    return { categorySpending, total };
  }, [expenseTransactions, activeCategories]);

  // Build color map for pie chart
  const colorMap = useMemo(() => {
    const categoryIds = activeCategories.map((c) => c.id);
    return buildCategoryColorMap(categoryIds);
  }, [activeCategories]);

  // Filter upcoming forecasts to only future dates and sort by date
  const upcomingItems = useMemo(() => {
    return expandedForecasts
      .filter((f) => f.date > today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10); // Show max 10 items
  }, [expandedForecasts, today]);

  // Format month name
  const monthName = new Date(today).toLocaleDateString('en-AU', { month: 'long' });

  // === Monthly Cash Flow Progress ===
  const monthlyCashFlow = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    // Get forecasts for the FULL month (not just 14 days)
    // We need to expand forecasts for the entire current month
    const monthForecasts = expandedForecasts.filter(
      (f) => f.date >= thisMonthStart && f.date <= thisMonthEnd
    );

    // Expected income for full month
    const expectedIncome = monthForecasts
      .filter((f) => f.type === 'income')
      .reduce((sum, f) => sum + f.amountCents, 0);

    // Expected savings for full month
    const expectedSavings = monthForecasts
      .filter((f) => f.type === 'savings')
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

    // Get category IDs that have budgets
    const budgetedCategoryIds = new Set(budgetRules.map((r) => r.categoryId));

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

    // Unallocated = Income - Budget - Savings (money available for unbudgeted spending or cash buffer)
    const unallocated = Math.round(expectedIncome - totalBudget - expectedSavings);

    // Net = Income - Savings - All Expenses
    const actualNet = actualIncome - actualSavings - actualBudgetedExpenses - actualUnbudgetedExpenses;

    return {
      dayOfMonth,
      daysInMonth,
      income: {
        expected: Math.round(expectedIncome),
        actual: actualIncome,
      },
      budgeted: {
        expected: Math.round(totalBudget),
        actual: actualBudgetedExpenses,
      },
      unbudgeted: {
        unallocated: Math.max(0, unallocated), // Available for unbudgeted or cash buffer
        actual: actualUnbudgetedExpenses,
      },
      savings: {
        expected: Math.round(expectedSavings),
        actual: actualSavings,
      },
      net: actualNet,
    };
  }, [expandedForecasts, budgetRules, allTransactions, thisMonthStart, today]);

  // === This Year Cash Flow Progress ===
  const yearlyCashFlow = useMemo(() => {
    // Expected income for full year (from forecasts)
    const expectedIncome = yearlyForecasts
      .filter((f) => f.type === 'income')
      .reduce((sum, f) => sum + f.amountCents, 0);

    // Expected savings for full year (from forecasts)
    const expectedSavings = yearlyForecasts
      .filter((f) => f.type === 'savings')
      .reduce((sum, f) => sum + f.amountCents, 0);

    // Total budget for full year (sum of all budget rules, annualized)
    const totalBudget = budgetRules.reduce((sum, r) => {
      switch (r.cadence) {
        case 'weekly':
          return sum + r.amountCents * 52;
        case 'fortnightly':
          return sum + r.amountCents * 26;
        case 'monthly':
          return sum + r.amountCents * 12;
        case 'quarterly':
          return sum + r.amountCents * 4;
        case 'yearly':
          return sum + r.amountCents;
        default:
          return sum + r.amountCents * 12;
      }
    }, 0);

    // Get category IDs that have budgets
    const budgetedCategoryIds = new Set(budgetRules.map((r) => r.categoryId));

    // Actual income received so far this year
    const actualIncome = yearTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amountCents, 0);

    // Actual savings so far this year
    const actualSavings = yearTransactions
      .filter((t) => t.type === 'savings')
      .reduce((sum, t) => sum + t.amountCents, 0);

    // Actual expenses - split by budgeted vs unbudgeted
    const expenseTransactionsThisYear = yearTransactions.filter((t) => t.type === 'expense');

    const actualBudgetedExpenses = expenseTransactionsThisYear
      .filter((t) => t.categoryId && budgetedCategoryIds.has(t.categoryId))
      .reduce((sum, t) => sum + t.amountCents, 0);

    const actualUnbudgetedExpenses = expenseTransactionsThisYear
      .filter((t) => !t.categoryId || !budgetedCategoryIds.has(t.categoryId))
      .reduce((sum, t) => sum + t.amountCents, 0);

    // Unallocated = Income - Budget - Savings (money available for unbudgeted spending or cash buffer)
    const unallocated = Math.round(expectedIncome - totalBudget - expectedSavings);

    return {
      income: {
        expected: Math.round(expectedIncome),
        actual: actualIncome,
      },
      budgeted: {
        expected: Math.round(totalBudget),
        actual: actualBudgetedExpenses,
      },
      unbudgeted: {
        unallocated: Math.max(0, unallocated), // Available for unbudgeted or cash buffer
        actual: actualUnbudgetedExpenses,
      },
      savings: {
        expected: Math.round(expectedSavings),
        actual: actualSavings,
      },
      net: unallocated, // Net forecast = unallocated amount
    };
  }, [yearlyForecasts, budgetRules, yearTransactions]);

  // Calculate upcoming net flow (income - expenses - savings)
  const upcomingNetFlow = useMemo(() => {
    return upcomingItems.reduce((sum, item) => {
      if (item.type === 'income') return sum + item.amountCents;
      return sum - item.amountCents;
    }, 0);
  }, [upcomingItems]);

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="space-y-6">
        <div className="mb-20">
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Eye className="h-7 w-7" />
            Overview
          </h1>
          <p className="mt-1 text-muted-foreground">Your current financial position at a glance</p>
        </div>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No scenario selected.</p>
          <Button asChild className="mt-4">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-20 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Eye className="h-7 w-7" />
            Overview
          </h1>
          <p className="mt-1 text-muted-foreground">Your current financial position at a glance</p>
        </div>
        <ScenarioSelector />
      </div>

      {/* Balance warning banner */}
      {hasNoAnchor && (
        <Alert variant="warning">
          <AlertTitle>No balance anchor set</AlertTitle>
          <AlertDescription>
            Set a starting balance in{' '}
            <Link to="/settings" className="underline">
              Settings
            </Link>{' '}
            to enable balance tracking.
          </AlertDescription>
        </Alert>
      )}

      {/* Net Worth Cards */}
      {(() => {
        // Dummy data for Debt and Investments (to be implemented later)
        const totalDebt = 2500000; // $25,000 placeholder
        const totalInvestments = 4500000; // $45,000 placeholder
        const netWorth = (currentBalance ?? 0) + totalSavings + totalInvestments - totalDebt;

        return (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {/* Cash */}
            <Link
              to="/analyse?tab=cashflow"
              className="flex flex-col rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Landmark className="h-4 w-4" />
                Cash
              </div>
              <div className="mt-2">
                {currentBalance !== null ? (
                  <p className="text-2xl font-bold">{formatCents(currentBalance)}</p>
                ) : (
                  <p className="text-2xl font-bold text-muted-foreground">—</p>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {currentBalance !== null ? 'Bank balance' : 'Not set'}
              </p>
            </Link>

            {/* Savings */}
            <Link
              to="/savings"
              className="flex flex-col rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <PiggyBank className="h-4 w-4" />
                Savings
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold text-blue-600">{formatCents(totalSavings)}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {emergencyFund && emergencyFundBalance !== null
                  ? `${formatCents(emergencyFundBalance)} emergency`
                  : 'Across all goals'}
              </p>
            </Link>

            {/* Debt */}
            <div className="flex flex-col rounded-lg border p-4 opacity-60">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                Debt
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold text-red-600">-{formatCents(totalDebt)}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Coming soon</p>
            </div>

            {/* Investments */}
            <div className="flex flex-col rounded-lg border p-4 opacity-60">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                Investments
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold text-green-600">{formatCents(totalInvestments)}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Coming soon</p>
            </div>

            {/* Net Worth */}
            <div className="flex flex-col rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Scale className="h-4 w-4" />
                Net Worth
              </div>
              <div className="mt-2">
                <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {netWorth >= 0 ? '' : '-'}{formatCents(Math.abs(netWorth))}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Assets minus liabilities
              </p>
            </div>
          </div>
        );
      })()}

      {/* Cash Flow Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* This Month */}
        <Link
          to="/analyse?tab=cashflow"
          className="block rounded-lg border p-5 transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 font-medium">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                {monthName}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Day {monthlyCashFlow.dayOfMonth} of {monthlyCashFlow.daysInMonth}
              </p>
            </div>
            <div className="text-right">
              <span className={`text-lg font-bold font-mono ${monthlyCashFlow.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {monthlyCashFlow.net >= 0 ? '+' : ''}{formatCents(monthlyCashFlow.net)}
              </span>
              <p className="text-xs text-muted-foreground">net so far</p>
            </div>
          </div>

          {(() => {
            const ref = Math.max(monthlyCashFlow.income.expected, monthlyCashFlow.income.actual, 1);
            const pct = (val: number) => `${Math.min((val / ref) * 100, 100)}%`;
            return (
              <div className="mt-4 space-y-3">
                {/* Income bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Income
                    </span>
                    <span className="font-mono">
                      <span className="text-green-600">{formatCents(monthlyCashFlow.income.actual)}</span>
                      <span className="text-muted-foreground"> / {formatCents(monthlyCashFlow.income.expected)}</span>
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted">
                    <div className="absolute h-2 rounded-full bg-green-500" style={{ width: pct(monthlyCashFlow.income.actual) }} />
                  </div>
                </div>

                {/* Budgeted expenses bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Receipt className="h-3.5 w-3.5" />
                      Budgeted
                    </span>
                    <span className="font-mono">
                      <span className="text-red-600">{formatCents(monthlyCashFlow.budgeted.actual)}</span>
                      <span className="text-muted-foreground"> / {formatCents(monthlyCashFlow.budgeted.expected)}</span>
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted">
                    <div className="absolute h-2 rounded-full bg-red-200" style={{ width: pct(monthlyCashFlow.budgeted.expected) }} />
                    <div className="absolute h-2 rounded-full bg-red-500" style={{ width: pct(monthlyCashFlow.budgeted.actual) }} />
                  </div>
                </div>

                {/* Unallocated bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <CircleAlert className="h-3.5 w-3.5" />
                      Unallocated
                    </span>
                    <span className="font-mono">
                      <span className="text-amber-600">{formatCents(monthlyCashFlow.unbudgeted.actual)}</span>
                      <span className="text-muted-foreground"> / {formatCents(monthlyCashFlow.unbudgeted.unallocated)}</span>
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted">
                    <div className="absolute h-2 rounded-full bg-amber-200" style={{ width: pct(monthlyCashFlow.unbudgeted.unallocated) }} />
                    <div className="absolute h-2 rounded-full bg-amber-500" style={{ width: pct(monthlyCashFlow.unbudgeted.actual) }} />
                  </div>
                </div>

                {/* Savings bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <PiggyBank className="h-3.5 w-3.5" />
                      Savings
                    </span>
                    <span className="font-mono">
                      <span className="text-blue-600">{formatCents(monthlyCashFlow.savings.actual)}</span>
                      <span className="text-muted-foreground"> / {formatCents(monthlyCashFlow.savings.expected)}</span>
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted">
                    <div className="absolute h-2 rounded-full bg-blue-200" style={{ width: pct(monthlyCashFlow.savings.expected) }} />
                    <div className="absolute h-2 rounded-full bg-blue-500" style={{ width: pct(monthlyCashFlow.savings.actual) }} />
                  </div>
                </div>
              </div>
            );
          })()}
        </Link>

        {/* This Year */}
        <Link
          to="/analyse?tab=cashflow"
          className="block rounded-lg border p-5 transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 font-medium">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                {currentYear}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Full year</p>
            </div>
            <div className="text-right">
              <span className={`text-lg font-bold font-mono ${yearlyCashFlow.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {yearlyCashFlow.net >= 0 ? '+' : ''}{formatCents(yearlyCashFlow.net)}
              </span>
              <p className="text-xs text-muted-foreground">net forecast</p>
            </div>
          </div>

          {(() => {
            const ref = Math.max(yearlyCashFlow.income.expected, yearlyCashFlow.income.actual, 1);
            const pct = (val: number) => `${Math.min((val / ref) * 100, 100)}%`;
            return (
              <div className="mt-4 space-y-3">
                {/* Income bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Income
                    </span>
                    <span className="font-mono">
                      <span className="text-green-600">{formatCents(yearlyCashFlow.income.actual)}</span>
                      <span className="text-muted-foreground"> / {formatCents(yearlyCashFlow.income.expected)}</span>
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted">
                    <div className="absolute h-2 rounded-full bg-green-500" style={{ width: pct(yearlyCashFlow.income.actual) }} />
                  </div>
                </div>

                {/* Budgeted expenses bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Receipt className="h-3.5 w-3.5" />
                      Budgeted
                    </span>
                    <span className="font-mono">
                      <span className="text-red-600">{formatCents(yearlyCashFlow.budgeted.actual)}</span>
                      <span className="text-muted-foreground"> / {formatCents(yearlyCashFlow.budgeted.expected)}</span>
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted">
                    <div className="absolute h-2 rounded-full bg-red-200" style={{ width: pct(yearlyCashFlow.budgeted.expected) }} />
                    <div className="absolute h-2 rounded-full bg-red-500" style={{ width: pct(yearlyCashFlow.budgeted.actual) }} />
                  </div>
                </div>

                {/* Unallocated bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <CircleAlert className="h-3.5 w-3.5" />
                      Unallocated
                    </span>
                    <span className="font-mono">
                      <span className="text-amber-600">{formatCents(yearlyCashFlow.unbudgeted.actual)}</span>
                      <span className="text-muted-foreground"> / {formatCents(yearlyCashFlow.unbudgeted.unallocated)}</span>
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted">
                    <div className="absolute h-2 rounded-full bg-amber-200" style={{ width: pct(yearlyCashFlow.unbudgeted.unallocated) }} />
                    <div className="absolute h-2 rounded-full bg-amber-500" style={{ width: pct(yearlyCashFlow.unbudgeted.actual) }} />
                  </div>
                </div>

                {/* Savings bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <PiggyBank className="h-3.5 w-3.5" />
                      Savings
                    </span>
                    <span className="font-mono">
                      <span className="text-blue-600">{formatCents(yearlyCashFlow.savings.actual)}</span>
                      <span className="text-muted-foreground"> / {formatCents(yearlyCashFlow.savings.expected)}</span>
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted">
                    <div className="absolute h-2 rounded-full bg-blue-200" style={{ width: pct(yearlyCashFlow.savings.expected) }} />
                    <div className="absolute h-2 rounded-full bg-blue-500" style={{ width: pct(yearlyCashFlow.savings.actual) }} />
                  </div>
                </div>
              </div>
            );
          })()}
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* This Month's Spending - Pie Chart */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{monthName} Spending</h2>
              <p className="text-sm text-muted-foreground">Breakdown by category</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">{formatCents(thisMonthSpending.total)}</p>
              <p className="text-xs text-muted-foreground">
                {thisMonthSpending.categorySpending.length} {thisMonthSpending.categorySpending.length === 1 ? 'category' : 'categories'}
              </p>
            </div>
          </div>

          {thisMonthSpending.categorySpending.length === 0 ? (
            <div className="mt-6 flex h-64 items-center justify-center text-sm text-muted-foreground">
              No expenses recorded this month.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280} className="mt-4">
                <PieChart>
                  <Pie
                    data={thisMonthSpending.categorySpending}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                  >
                    {thisMonthSpending.categorySpending.map((item) => (
                      <Cell
                        key={item.id}
                        fill={colorMap[item.id] ?? CHART_COLORS.uncategorized}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                {thisMonthSpending.categorySpending.map((item) => (
                  <div key={item.id} className="flex items-center gap-1.5 text-sm">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: colorMap[item.id] ?? CHART_COLORS.uncategorized }}
                    />
                    <span>{item.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatCents(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mt-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/transactions">View all transactions</Link>
            </Button>
          </div>
        </div>

        {/* Upcoming */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Upcoming</h2>
              <p className="text-sm text-muted-foreground">Next 14 days</p>
            </div>
            {upcomingItems.length > 0 && (
              <div className="text-right">
                <p className={`text-lg font-bold ${upcomingNetFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {upcomingNetFlow >= 0 ? '+' : ''}{formatCents(upcomingNetFlow)}
                </p>
                <p className="text-xs text-muted-foreground">net flow</p>
              </div>
            )}
          </div>

          {upcomingItems.length === 0 ? (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              No forecasts in the next 14 days.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {upcomingItems.map((item, index) => (
                <div key={`${item.sourceId}-${item.date}-${index}`} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    {item.type === 'income' ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : item.type === 'savings' ? (
                      <PiggyBank className="h-4 w-4 text-blue-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`font-mono text-sm ${
                        item.type === 'income'
                          ? 'text-green-600'
                          : item.type === 'savings'
                            ? 'text-blue-600'
                            : 'text-red-600'
                      }`}
                    >
                      {item.type === 'income' ? '+' : '-'}
                      {formatCents(item.amountCents)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/forecasts">Manage forecasts</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
