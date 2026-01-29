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
import { ScenarioSelector } from '@/components/scenario-selector';
import { formatCents, formatDate, formatISODate } from '@/lib/utils';
import type { Cadence } from '@/lib/types';

/**
 * Get period progress info for a given cadence
 */
function getPeriodProgress(cadence: Cadence): { daysElapsed: number; totalDays: number; progress: number } {
  const range = getCurrentPeriodRange(cadence);
  const start = new Date(range.start);
  const end = new Date(range.end);
  const now = new Date();

  // Set to start of day for accurate day counting
  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysElapsed = Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const progress = Math.min((daysElapsed / totalDays) * 100, 100);

  return { daysElapsed, totalDays, progress };
}

/**
 * Get the current period date range for a given cadence
 */
function getCurrentPeriodRange(cadence: Cadence): { start: string; end: string } {
  const now = new Date();

  switch (cadence) {
    case 'weekly': {
      // Monday to Sunday containing today
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(monday.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      return { start: formatISODate(monday), end: formatISODate(sunday) };
    }
    case 'fortnightly': {
      // Use a fixed epoch (Jan 1, 2024 was a Monday) to determine fortnight boundaries
      const epoch = new Date('2024-01-01');
      const diffDays = Math.floor((now.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
      const fortnightNumber = Math.floor(diffDays / 14);
      const fortnightStart = new Date(epoch);
      fortnightStart.setDate(fortnightStart.getDate() + fortnightNumber * 14);
      const fortnightEnd = new Date(fortnightStart);
      fortnightEnd.setDate(fortnightEnd.getDate() + 13);
      return { start: formatISODate(fortnightStart), end: formatISODate(fortnightEnd) };
    }
    case 'monthly': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: formatISODate(start), end: formatISODate(end) };
    }
    case 'quarterly': {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), quarterStart, 1);
      const end = new Date(now.getFullYear(), quarterStart + 3, 0);
      return { start: formatISODate(start), end: formatISODate(end) };
    }
    case 'yearly': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { start: formatISODate(start), end: formatISODate(end) };
    }
  }
}

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

  // Calculate budget health - same logic as budget page (respects per-category cadences + burn rate)
  const budgetHealth = useMemo(() => {
    if (!budgetRules || budgetRules.length === 0) {
      return { status: 'no-budget' as const, onTrack: 0, overBudget: 0, overspending: 0, watch: 0, total: 0 };
    }

    let onTrack = 0;
    let overBudget = 0;
    let overspending = 0;
    let watch = 0;

    for (const rule of budgetRules) {
      if (rule.amountCents === 0) continue;

      // Calculate period range based on rule's cadence
      const periodRange = getCurrentPeriodRange(rule.cadence);
      const periodInfo = getPeriodProgress(rule.cadence);

      // Sum expenses for this category in the period
      const categoryExpenses = allTransactions.filter(
        (t) =>
          t.type === 'expense' &&
          t.categoryId === rule.categoryId &&
          t.date >= periodRange.start &&
          t.date <= periodRange.end,
      );
      const spent = categoryExpenses.reduce((sum, t) => sum + t.amountCents, 0);
      const spentPercent = (spent / rule.amountCents) * 100;

      // Calculate burn rate (spending pace vs period progress)
      const expectedSpend = rule.amountCents * (periodInfo.progress / 100);
      const burnRate = expectedSpend > 0 ? (spent / expectedSpend) * 100 : (spent > 0 ? 200 : 0);

      // Match budget page logic: use burn rate for status
      if (spentPercent >= 100) {
        overBudget++;
      } else if (burnRate > 120) {
        overspending++;
      } else if (burnRate > 100) {
        watch++;
      } else {
        onTrack++;
      }
    }

    const total = onTrack + overBudget + overspending + watch;
    const problemCount = overBudget + overspending;
    // Only show bad if majority are problematic (over or overspending)
    // Warning if any are overspending but most are fine
    // Good if all on track or just watching
    const status = problemCount > total / 2 ? 'bad' : (problemCount > 0 ? 'warning' : 'good');

    return { status: status as 'good' | 'warning' | 'bad', onTrack, overBudget, overspending, watch, total };
  }, [budgetRules, allTransactions]);

  // Filter upcoming forecasts to only future dates and sort by date
  const upcomingItems = useMemo(() => {
    return expandedForecasts
      .filter((f) => f.date > today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10); // Show max 10 items
  }, [expandedForecasts, today]);

  // Calculate safe to spend = min(remaining budget, projected balance after obligations)
  const safeToSpend = useMemo(() => {
    // If no budgets, can't calculate safe to spend
    if (!budgetRules || budgetRules.length === 0) {
      return { status: 'no-budget' as const };
    }

    // Calculate remaining budget across all budget rules
    let totalBudgeted = 0;
    let totalSpent = 0;

    for (const rule of budgetRules) {
      if (rule.amountCents === 0) continue;

      // Get period range for this rule's cadence
      const periodRange = getCurrentPeriodRange(rule.cadence);

      // Sum expenses for this category in the period
      const categoryExpenses = allTransactions.filter(
        (t) =>
          t.type === 'expense' &&
          t.categoryId === rule.categoryId &&
          t.date >= periodRange.start &&
          t.date <= periodRange.end,
      );
      const spent = categoryExpenses.reduce((sum, t) => sum + t.amountCents, 0);

      totalBudgeted += rule.amountCents;
      totalSpent += Math.min(spent, rule.amountCents); // Cap at budget to avoid negative remaining
    }

    const remainingBudget = totalBudgeted - totalSpent;

    // Calculate projected balance after obligations (next 30 days)
    // If no balance anchor, we can still show remaining budget but flag the cash check
    if (currentBalance === null) {
      return {
        status: 'no-balance' as const,
        totalBudgeted,
        totalSpent,
        remainingBudget,
      };
    }

    // Get forecasts for next 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const horizonEnd = thirtyDaysFromNow.toISOString().slice(0, 10);

    // Sum forecasted income, expenses, savings
    const futureForecasts = expandedForecasts.filter((f) => f.date > today && f.date <= horizonEnd);
    const forecastedIncome = futureForecasts
      .filter((f) => f.type === 'income')
      .reduce((sum, f) => sum + f.amountCents, 0);
    const forecastedExpenses = futureForecasts
      .filter((f) => f.type === 'expense')
      .reduce((sum, f) => sum + f.amountCents, 0);
    const forecastedSavings = futureForecasts
      .filter((f) => f.type === 'savings')
      .reduce((sum, f) => sum + f.amountCents, 0);

    const projectedBalance = currentBalance + forecastedIncome - forecastedExpenses - forecastedSavings;

    // Safe to spend = lesser of remaining budget and projected balance
    const amount = Math.min(remainingBudget, projectedBalance);
    const constrainedByBalance = projectedBalance < remainingBudget;

    return {
      status: 'ok' as const,
      amount,
      totalBudgeted,
      totalSpent,
      remainingBudget,
      projectedBalance,
      constrainedByBalance,
    };
  }, [budgetRules, allTransactions, currentBalance, expandedForecasts, today]);

  // Format month name
  const monthName = new Date(today).toLocaleDateString('en-AU', { month: 'long' });

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

      {/* Current Position Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/analyse?tab=cashflow"
          className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <div>
            <div className="flex items-center gap-2 font-medium">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              Cash Position
            </div>
            <p className="text-xs text-muted-foreground">Your actual money right now</p>
          </div>
          {currentBalance !== null ? (
            <p className="mt-2 text-2xl font-bold">{formatCents(currentBalance)}</p>
          ) : (
            <p className="mt-2 text-2xl font-bold text-muted-foreground">—</p>
          )}
        </Link>

        <Link
          to="/budget"
          className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <div>
            <div className="flex items-center gap-2 font-medium">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Spendable
            </div>
            <p className="text-xs text-muted-foreground">Can your income cover your budget?</p>
          </div>
          {safeToSpend.status === 'no-budget' ? (
            <>
              <p className="mt-2 text-2xl font-bold text-muted-foreground">—</p>
              <p className="text-sm text-muted-foreground">Set up budgets first</p>
            </>
          ) : safeToSpend.status === 'no-balance' ? (
            <>
              <p className="mt-2 text-2xl font-bold text-green-600">
                {formatCents(safeToSpend.remainingBudget)}
              </p>
              <p className="text-sm text-muted-foreground">Set balance to verify cash</p>
            </>
          ) : safeToSpend.amount < 0 ? (
            <>
              <p className="mt-2 text-2xl font-bold text-red-600">$0</p>
              <p className="text-sm text-muted-foreground">
                {formatCents(safeToSpend.amount)} shortfall on budgeted
              </p>
            </>
          ) : safeToSpend.constrainedByBalance ? (
            <>
              <p className="mt-2 text-2xl font-bold text-amber-600">
                {formatCents(safeToSpend.amount)}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatCents(safeToSpend.remainingBudget)} budgeted but cash is tight
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-2xl font-bold text-green-600">
                {formatCents(safeToSpend.amount)}
              </p>
              <p className="text-sm text-muted-foreground">
                Remaining from {formatCents(safeToSpend.totalBudgeted)} budget
              </p>
            </>
          )}
        </Link>

        <Link
          to="/budget"
          className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <div>
            <div className="flex items-center gap-2 font-medium">
              {budgetHealth.status === 'no-budget' ? (
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              ) : budgetHealth.overBudget > 0 ? (
                <XCircle className="h-4 w-4 text-red-600" />
              ) : budgetHealth.overspending > 0 ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              Spending Rate
            </div>
            <p className="text-xs text-muted-foreground">Are you burning budget too fast?</p>
          </div>
          {budgetHealth.status === 'no-budget' ? (
            <>
              <p className="mt-2 text-2xl font-bold text-muted-foreground">—</p>
              <p className="text-sm text-muted-foreground">No budgets set</p>
            </>
          ) : budgetHealth.overBudget > 0 ? (
            <>
              <p className="mt-2 text-2xl font-bold text-red-600">Too Fast</p>
              <p className="text-sm text-muted-foreground">
                {budgetHealth.overBudget} {budgetHealth.overBudget === 1 ? 'budget' : 'budgets'} exceeded
                {budgetHealth.overspending > 0 && `, ${budgetHealth.overspending} overspending`}
              </p>
            </>
          ) : budgetHealth.overspending > 0 ? (
            <>
              <p className="mt-2 text-2xl font-bold text-amber-600">Speeding Up</p>
              <p className="text-sm text-muted-foreground">
                {budgetHealth.overspending} {budgetHealth.overspending === 1 ? 'budget' : 'budgets'} overspending
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-2xl font-bold text-green-600">On Track</p>
              <p className="text-sm text-muted-foreground">
                {budgetHealth.watch > 0
                  ? `${budgetHealth.onTrack} on pace, ${budgetHealth.watch} to watch`
                  : `All ${budgetHealth.total} budgets on pace`}
              </p>
            </>
          )}
        </Link>

        <Link
          to="/analyse?tab=savings"
          className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <div>
            <div className="flex items-center gap-2 font-medium">
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
              Total Savings
            </div>
            <p className="text-xs text-muted-foreground">Total across all goals</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-600">{formatCents(totalSavings)}</p>
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
