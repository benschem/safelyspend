import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, TrendingDown, PiggyBank, LayoutDashboard } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { formatCents, formatDate } from '@/lib/utils';
import { ScenarioSelector } from '@/components/scenario-selector';

interface OutletContext {
  activeScenarioId: string | null;
}

export function DashboardPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { activeCategories } = useCategories();
  const { getActiveAnchor } = useBalanceAnchors();

  // Fixed date ranges - no user selection
  const today = new Date().toISOString().slice(0, 10);

  // This month's date range
  const thisMonthStart = today.slice(0, 7) + '-01';
  const thisMonthEnd = today;

  // Upcoming forecasts: next 14 days
  const fourteenDaysFromNow = new Date();
  fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
  const upcomingEnd = fourteenDaysFromNow.toISOString().slice(0, 10);

  // Get transactions for this month (for spending summary)
  const { allTransactions, expenseTransactions } = useTransactions(thisMonthStart, thisMonthEnd);

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Bank Balance</p>
          {currentBalance !== null ? (
            <p className="text-2xl font-bold">{formatCents(currentBalance)}</p>
          ) : (
            <p className="text-2xl font-bold text-muted-foreground">—</p>
          )}
          <p className="text-sm text-muted-foreground">As of today</p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Free to Spend</p>
          {freeToSpend !== null ? (
            <>
              <p className={`text-2xl font-bold ${freeToSpend.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
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
              <p className="text-2xl font-bold text-muted-foreground">—</p>
              <p className="text-sm text-muted-foreground">Set balance anchor first</p>
            </>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Spent in {monthName}</p>
          <p className="text-2xl font-bold">{formatCents(thisMonthSpending.total)}</p>
          <p className="text-sm text-muted-foreground">
            {thisMonthSpending.categorySpending.length} {thisMonthSpending.categorySpending.length === 1 ? 'category' : 'categories'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* This Month's Spending */}
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">{monthName} Spending</h2>
          <p className="text-sm text-muted-foreground">Breakdown by category</p>

          {thisMonthSpending.categorySpending.length === 0 ? (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              No expenses recorded this month.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {thisMonthSpending.categorySpending.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <span className="text-sm">{item.name}</span>
                  <span className="font-mono text-sm">{formatCents(item.amount)}</span>
                </div>
              ))}
              <div className="border-t pt-2">
                <div className="flex items-center justify-between font-medium">
                  <span>Total</span>
                  <span className="font-mono">{formatCents(thisMonthSpending.total)}</span>
                </div>
              </div>
            </div>
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
