import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  LayoutDashboard,
  Landmark,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { CHART_COLORS, buildCategoryColorMap } from '@/lib/chart-colors';
import { useScenarios } from '@/hooks/use-scenarios';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { formatCents, formatDate } from '@/lib/utils';
import { ScenarioSelector } from '@/components/scenario-selector';

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

export function DashboardPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { activeCategories } = useCategories();
  const { getActiveAnchor } = useBalanceAnchors();

  // Fixed date ranges - no user selection
  const today = new Date().toISOString().slice(0, 10);

  // This month's date range (needed before budget rules hook)
  const thisMonthStart = today.slice(0, 7) + '-01';
  const thisMonthEnd = today;

  // Get budget rules for this month
  const { expandedBudgets } = useBudgetRules(activeScenarioId, thisMonthStart, thisMonthEnd);

  // Upcoming forecasts: next 14 days
  const fourteenDaysFromNow = new Date();
  fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
  const upcomingEnd = fourteenDaysFromNow.toISOString().slice(0, 10);

  // Get transactions for this month (for spending summary)
  const { allTransactions, expenseTransactions } = useTransactions(thisMonthStart, thisMonthEnd);

  // Calculate total savings (all time)
  const totalSavings = useMemo(() => {
    return allTransactions
      .filter((t) => t.type === 'savings')
      .reduce((sum, t) => sum + t.amountCents, 0);
  }, [allTransactions]);

  // Get forecasts for upcoming period
  const { expandedForecasts } = useForecasts(activeScenarioId, today, upcomingEnd);

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

  // Calculate budget health for the month
  const budgetHealth = useMemo(() => {
    const budgetedCategoryIds = Object.keys(expandedBudgets);
    if (budgetedCategoryIds.length === 0) {
      return { status: 'no-budget' as const, onTrack: 0, overBudget: 0, total: 0 };
    }

    let onTrack = 0;
    let overBudget = 0;

    for (const categoryId of budgetedCategoryIds) {
      const budget = expandedBudgets[categoryId] ?? 0;
      if (budget === 0) continue;

      const spent = thisMonthSpending.categorySpending.find((c) => c.id === categoryId)?.amount ?? 0;
      if (spent > budget) {
        overBudget++;
      } else {
        onTrack++;
      }
    }

    const total = onTrack + overBudget;
    const status = overBudget === 0 ? 'good' : overBudget <= total / 2 ? 'warning' : 'bad';

    return { status: status as 'good' | 'warning' | 'bad', onTrack, overBudget, total };
  }, [expandedBudgets, thisMonthSpending.categorySpending]);

  // Filter upcoming forecasts to only future dates and sort by date
  const upcomingItems = useMemo(() => {
    return expandedForecasts
      .filter((f) => f.date > today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10); // Show max 10 items
  }, [expandedForecasts, today]);

  // Calculate free to spend (balance minus committed expenses until next income)
  const freeToSpend = useMemo(() => {
    if (currentBalance === null) return null;

    // Find next income
    const sortedFutureIncome = upcomingItems
      .filter((f) => f.type === 'income')
      .sort((a, b) => a.date.localeCompare(b.date));

    const nextIncomeDate = sortedFutureIncome[0]?.date ?? upcomingEnd;

    // Sum expenses and savings until next income
    const committed = upcomingItems
      .filter((f) => f.date <= nextIncomeDate && (f.type === 'expense' || f.type === 'savings'))
      .reduce((sum, f) => sum + f.amountCents, 0);

    return {
      amount: currentBalance - committed,
      untilDate: nextIncomeDate,
      hasIncome: sortedFutureIncome.length > 0,
    };
  }, [currentBalance, upcomingItems, upcomingEnd]);

  // Format month name
  const monthName = new Date(today).toLocaleDateString('en-AU', { month: 'long' });

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <LayoutDashboard className="h-7 w-7" />
            Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">Your current financial position</p>
        </div>
        <ScenarioSelector />
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Select a scenario to view your dashboard.</p>
          <Button asChild className="mt-4">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <LayoutDashboard className="h-7 w-7" />
          Dashboard
        </h1>
        <p className="mt-1 text-muted-foreground">Your current financial position</p>
      </div>

      <ScenarioSelector />

      {/* Balance warning banner */}
      {hasNoAnchor && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              No balance anchor set
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Set a starting balance in{' '}
              <Link to="/settings" className="underline">
                Settings
              </Link>{' '}
              to enable balance tracking.
            </p>
          </div>
        </div>
      )}

      {/* Current Position Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/reports?tab=cashflow"
          className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Landmark className="h-4 w-4" />
            Bank Balance
          </div>
          {currentBalance !== null ? (
            <p className="mt-1 text-2xl font-bold">{formatCents(currentBalance)}</p>
          ) : (
            <p className="mt-1 text-2xl font-bold text-muted-foreground">—</p>
          )}
          <p className="text-sm text-muted-foreground">As of today</p>
        </Link>

        <Link
          to="/reports?tab=spending"
          className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4" />
            Free to Spend
          </div>
          {freeToSpend !== null ? (
            <>
              <p className={`mt-1 text-2xl font-bold ${freeToSpend.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCents(freeToSpend.amount)}
              </p>
              <p className="text-sm text-muted-foreground">
                {freeToSpend.hasIncome
                  ? `Until ${formatDate(freeToSpend.untilDate)}`
                  : 'Next 14 days'}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-2xl font-bold text-muted-foreground">—</p>
              <p className="text-sm text-muted-foreground">Set balance anchor first</p>
            </>
          )}
        </Link>

        <Link
          to="/budget"
          className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {budgetHealth.status === 'good' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            {budgetHealth.status === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
            {budgetHealth.status === 'bad' && <XCircle className="h-4 w-4 text-red-600" />}
            {budgetHealth.status === 'no-budget' && <AlertCircle className="h-4 w-4" />}
            Budget Health
          </div>
          {budgetHealth.status === 'no-budget' ? (
            <>
              <p className="mt-1 text-2xl font-bold text-muted-foreground">—</p>
              <p className="text-sm text-muted-foreground">No budgets set</p>
            </>
          ) : (
            <>
              <p className={`mt-1 text-2xl font-bold ${
                budgetHealth.status === 'good' ? 'text-green-600' :
                budgetHealth.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {budgetHealth.onTrack}/{budgetHealth.total} on track
              </p>
              <p className="text-sm text-muted-foreground">
                {budgetHealth.overBudget === 0
                  ? 'All categories within budget'
                  : `${budgetHealth.overBudget} over budget`}
              </p>
            </>
          )}
        </Link>

        <Link
          to="/reports?tab=savings"
          className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PiggyBank className="h-4 w-4" />
            Total Savings
          </div>
          <p className="mt-1 text-2xl font-bold text-blue-600">{formatCents(totalSavings)}</p>
          <p className="text-sm text-muted-foreground">All time</p>
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
            <div className="mt-4 flex h-64 items-center justify-center text-sm text-muted-foreground">
              No expenses recorded this month.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
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
          <h2 className="text-lg font-semibold">Upcoming</h2>
          <p className="text-sm text-muted-foreground">Next 14 days</p>

          {upcomingItems.length === 0 ? (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              No forecasts in the next 14 days.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
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
