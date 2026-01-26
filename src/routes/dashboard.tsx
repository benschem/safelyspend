import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { usePeriods } from '@/hooks/use-periods';
import { useAccounts } from '@/hooks/use-accounts';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { useOpeningBalances } from '@/hooks/use-opening-balances';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useBudgetLines } from '@/hooks/use-budget-lines';
import { useCategories } from '@/hooks/use-categories';
import { formatCents, formatDate } from '@/lib/utils';

interface OutletContext {
  activePeriodId: string | null;
}

export function DashboardPage() {
  const { activePeriodId } = useOutletContext<OutletContext>();
  const { periods } = usePeriods();
  const { activeAccounts } = useAccounts();
  const activePeriod = periods.find((p) => p.id === activePeriodId) ?? null;
  const { incomeTransactions, expenseTransactions, savingsTransactions } =
    useTransactions(activePeriod);
  const { incomeForecasts, expenseForecasts, savingsForecasts } = useForecasts(activePeriodId);
  const { getBalanceForAccount } = useOpeningBalances(activePeriodId);
  const { savingsGoals } = useSavingsGoals(activePeriodId);
  const { getBudgetForCategory } = useBudgetLines(activePeriodId);
  const { activeCategories } = useCategories();

  if (!activePeriodId || !activePeriod) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No period selected</h2>
        <p className="text-muted-foreground">Create a period to get started.</p>
        <Button asChild className="mt-4">
          <Link to="/manage/periods/new">Create Period</Link>
        </Button>
      </div>
    );
  }

  // Calculate totals
  const totalOpeningBalance = activeAccounts.reduce(
    (sum, acc) => sum + getBalanceForAccount(acc.id),
    0,
  );

  const actualIncome = incomeTransactions.reduce((sum, t) => sum + t.amountCents, 0);
  const actualExpenses = expenseTransactions.reduce((sum, t) => sum + t.amountCents, 0);
  const actualSavings = savingsTransactions.reduce((sum, t) => sum + t.amountCents, 0);
  const actualNet = actualIncome - actualExpenses - actualSavings;

  const forecastedIncome = incomeForecasts.reduce((sum, f) => sum + f.amountCents, 0);
  const forecastedExpenses = expenseForecasts.reduce((sum, f) => sum + f.amountCents, 0);
  const forecastedSavings = savingsForecasts.reduce((sum, f) => sum + f.amountCents, 0);
  const forecastedNet = forecastedIncome - forecastedExpenses - forecastedSavings;

  const currentBalance = totalOpeningBalance + actualNet;
  const projectedEndBalance = totalOpeningBalance + actualNet + forecastedNet;

  // Total saved is from savings transactions (actual savings)
  const totalSaved = actualSavings;
  const totalTarget = savingsGoals.reduce((sum, g) => sum + g.targetAmountCents, 0);

  // Calculate budget tracking per category
  const spendingByCategory = useMemo(() => {
    const spending: Record<string, number> = {};
    for (const tx of expenseTransactions) {
      if (tx.categoryId) {
        spending[tx.categoryId] = (spending[tx.categoryId] ?? 0) + tx.amountCents;
      }
    }
    return spending;
  }, [expenseTransactions]);

  const forecastedByCategory = useMemo(() => {
    const forecasted: Record<string, number> = {};
    for (const f of expenseForecasts) {
      if (f.categoryId) {
        forecasted[f.categoryId] = (forecasted[f.categoryId] ?? 0) + f.amountCents;
      }
    }
    return forecasted;
  }, [expenseForecasts]);

  const budgetRows = useMemo(() => {
    return activeCategories
      .map((category) => {
        const budgeted = getBudgetForCategory(category.id);
        const actual = spendingByCategory[category.id] ?? 0;
        const forecasted = forecastedByCategory[category.id] ?? 0;
        const remaining = budgeted - actual - forecasted;
        return { id: category.id, name: category.name, budgeted, actual, forecasted, remaining };
      })
      .filter((row) => row.budgeted > 0 || row.actual > 0 || row.forecasted > 0);
  }, [activeCategories, getBudgetForCategory, spendingByCategory, forecastedByCategory]);

  // Colors for breakdown segments
  const segmentColors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-violet-500',
    'bg-fuchsia-500',
  ];

  // Calculate actual spending breakdown by category
  const actualBreakdown = useMemo(() => {
    const segments: Array<{ id: string; name: string; amount: number; color: string }> = [];
    let colorIndex = 0;

    // Add category spending
    for (const category of activeCategories) {
      const amount = spendingByCategory[category.id] ?? 0;
      if (amount > 0) {
        segments.push({
          id: category.id,
          name: category.name,
          amount,
          color: segmentColors[colorIndex % segmentColors.length]!,
        });
        colorIndex++;
      }
    }

    // Add uncategorized expenses
    const uncategorizedExpenses = expenseTransactions
      .filter((t) => !t.categoryId)
      .reduce((sum, t) => sum + t.amountCents, 0);
    if (uncategorizedExpenses > 0) {
      segments.push({
        id: 'uncategorized',
        name: 'Uncategorized',
        amount: uncategorizedExpenses,
        color: 'bg-gray-400',
      });
    }

    // Add savings
    if (actualSavings > 0) {
      segments.push({
        id: 'savings',
        name: 'Savings',
        amount: actualSavings,
        color: 'bg-blue-500',
      });
    }

    // Add unallocated (remaining from income)
    const totalAllocated = segments.reduce((sum, s) => sum + s.amount, 0);
    const unallocated = actualIncome - totalAllocated;
    if (unallocated > 0) {
      segments.push({
        id: 'unallocated',
        name: 'Unallocated',
        amount: unallocated,
        color: 'bg-gray-200',
      });
    }

    return { segments, total: actualIncome };
  }, [activeCategories, spendingByCategory, expenseTransactions, actualSavings, actualIncome]);

  // Calculate forecast breakdown by category
  const forecastBreakdown = useMemo(() => {
    const segments: Array<{ id: string; name: string; amount: number; color: string }> = [];
    let colorIndex = 0;

    // Build forecast spending by category
    const forecastByCategory: Record<string, number> = {};
    for (const f of expenseForecasts) {
      if (f.categoryId) {
        forecastByCategory[f.categoryId] = (forecastByCategory[f.categoryId] ?? 0) + f.amountCents;
      }
    }

    // Add category spending
    for (const category of activeCategories) {
      const amount = forecastByCategory[category.id] ?? 0;
      if (amount > 0) {
        segments.push({
          id: category.id,
          name: category.name,
          amount,
          color: segmentColors[colorIndex % segmentColors.length]!,
        });
        colorIndex++;
      }
    }

    // Add uncategorized forecast expenses
    const uncategorizedForecasts = expenseForecasts
      .filter((f) => !f.categoryId)
      .reduce((sum, f) => sum + f.amountCents, 0);
    if (uncategorizedForecasts > 0) {
      segments.push({
        id: 'uncategorized',
        name: 'Uncategorized',
        amount: uncategorizedForecasts,
        color: 'bg-gray-400',
      });
    }

    // Add savings
    if (forecastedSavings > 0) {
      segments.push({
        id: 'savings',
        name: 'Savings',
        amount: forecastedSavings,
        color: 'bg-blue-500',
      });
    }

    // Add unallocated (remaining from income)
    const totalAllocated = segments.reduce((sum, s) => sum + s.amount, 0);
    const unallocated = forecastedIncome - totalAllocated;
    if (unallocated > 0) {
      segments.push({
        id: 'unallocated',
        name: 'Unallocated',
        amount: unallocated,
        color: 'bg-gray-200',
      });
    }

    return { segments, total: forecastedIncome };
  }, [activeCategories, expenseForecasts, forecastedSavings, forecastedIncome]);

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {formatDate(activePeriod.startDate)} - {formatDate(activePeriod.endDate)}
      </h1>
      <p className="text-muted-foreground">Your money at a glance</p>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p className="text-2xl font-bold">{formatCents(currentBalance)}</p>
          {totalOpeningBalance !== 0 && (
            <p className={`text-sm ${actualNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {actualNet >= 0 ? '+' : ''}
              {((actualNet / totalOpeningBalance) * 100).toFixed(1)}%
            </p>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Savings</p>
          <p className="text-2xl font-bold">{formatCents(totalSaved)}</p>
          {totalSaved > 0 && totalTarget > 0 && (
            <p className="text-sm text-green-600">
              +{((totalSaved / totalTarget) * 100).toFixed(1)}%
            </p>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Projected Balance</p>
          <p
            className={`text-2xl font-bold ${projectedEndBalance >= 0 ? '' : 'text-red-600'}`}
          >
            {formatCents(projectedEndBalance)}
          </p>
          {totalOpeningBalance !== 0 && (
            <p
              className={`text-sm ${actualNet + forecastedNet >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {actualNet + forecastedNet >= 0 ? '+' : ''}
              {(((actualNet + forecastedNet) / totalOpeningBalance) * 100).toFixed(1)}%
            </p>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Unallocated</p>
          <p className="text-2xl font-bold">{formatCents(Math.max(0, projectedEndBalance))}</p>
        </div>
      </div>

      {/* Actual vs Forecast */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Actual */}
        <div className="rounded-lg border p-4">
          <div className="flex items-baseline gap-1">
            <h2 className="text-lg font-semibold">Actual</h2>
            <span className="text-sm text-muted-foreground">(To Date)</span>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Income</span>
              <span className="font-mono text-green-600">+{formatCents(actualIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expenses</span>
              <span className="font-mono text-red-600">-{formatCents(actualExpenses)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Savings</span>
              <span className="font-mono text-blue-600">-{formatCents(actualSavings)}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-end font-semibold">
                <span className={actualNet >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {actualNet >= 0 ? '+' : ''}
                  {formatCents(actualNet)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Forecast */}
        <div className="rounded-lg border p-4">
          <div className="flex items-baseline gap-1">
            <h2 className="text-lg font-semibold">Forecast</h2>
            <span className="text-sm text-muted-foreground">(Remaining)</span>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Income</span>
              <span className="font-mono text-green-600">+{formatCents(forecastedIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expenses</span>
              <span className="font-mono text-red-600">-{formatCents(forecastedExpenses)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Savings</span>
              <span className="font-mono text-blue-600">-{formatCents(forecastedSavings)}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-end font-semibold">
                <span className={forecastedNet >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {forecastedNet >= 0 ? '+' : ''}
                  {formatCents(forecastedNet)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Income Breakdown */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Actual Breakdown */}
        <div className="rounded-lg border p-4">
          <div className="flex items-baseline gap-1">
            <h2 className="text-lg font-semibold">Actual Breakdown</h2>
            <span className="text-sm text-muted-foreground">(To Date)</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatCents(actualBreakdown.total)} income
          </p>

          {actualBreakdown.total === 0 ? (
            <div className="mt-4 text-center text-sm text-muted-foreground">No income yet.</div>
          ) : (
            <>
              {/* Stacked bar */}
              <div className="mt-4 flex h-6 w-full overflow-hidden rounded-full">
                {actualBreakdown.segments.map((segment) => {
                  const percentage = (segment.amount / actualBreakdown.total) * 100;
                  return (
                    <div
                      key={segment.id}
                      className={`${segment.color} transition-all`}
                      style={{ width: `${percentage}%` }}
                      title={`${segment.name}: ${formatCents(segment.amount)}`}
                    />
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {actualBreakdown.segments.map((segment) => {
                  const percentage = ((segment.amount / actualBreakdown.total) * 100).toFixed(0);
                  return (
                    <div key={segment.id} className="flex items-center gap-1.5 text-xs">
                      <div className={`h-2.5 w-2.5 rounded-sm ${segment.color}`} />
                      <span>
                        {segment.name} ({percentage}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Forecast Breakdown */}
        <div className="rounded-lg border p-4">
          <div className="flex items-baseline gap-1">
            <h2 className="text-lg font-semibold">Forecast Breakdown</h2>
            <span className="text-sm text-muted-foreground">(Remaining)</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatCents(forecastBreakdown.total)} income
          </p>

          {forecastBreakdown.total === 0 ? (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              No forecasted income.
            </div>
          ) : (
            <>
              {/* Stacked bar */}
              <div className="mt-4 flex h-6 w-full overflow-hidden rounded-full">
                {forecastBreakdown.segments.map((segment) => {
                  const percentage = (segment.amount / forecastBreakdown.total) * 100;
                  return (
                    <div
                      key={segment.id}
                      className={`${segment.color} transition-all`}
                      style={{ width: `${percentage}%` }}
                      title={`${segment.name}: ${formatCents(segment.amount)}`}
                    />
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {forecastBreakdown.segments.map((segment) => {
                  const percentage = ((segment.amount / forecastBreakdown.total) * 100).toFixed(0);
                  return (
                    <div key={segment.id} className="flex items-center gap-1.5 text-xs">
                      <div className={`h-2.5 w-2.5 rounded-sm ${segment.color}`} />
                      <span>
                        {segment.name} ({percentage}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Budget & Savings */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Budget Tracking */}
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Budget</h2>
          {budgetRows.length === 0 ? (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              No budget set.{' '}
              <Link to={`/manage/periods/${activePeriodId}`} className="text-primary underline">
                Set budgets
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {budgetRows.map((row) => {
                const actualPercent =
                  row.budgeted > 0 ? Math.min(100, (row.actual / row.budgeted) * 100) : 0;
                const forecastedPercent =
                  row.budgeted > 0
                    ? Math.min(100 - actualPercent, (row.forecasted / row.budgeted) * 100)
                    : 0;
                const isOver = row.remaining < 0;
                const willBeOver = row.budgeted - row.actual - row.forecasted < 0;
                return (
                  <div key={row.id}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{row.name}</span>
                      <span className={`text-muted-foreground ${isOver ? 'text-red-600' : ''}`}>
                        {formatCents(row.remaining)} / {formatCents(row.budgeted)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div className="flex h-full">
                        <div
                          className={`${isOver ? 'bg-red-600' : 'bg-primary'} transition-all`}
                          style={{ width: `${actualPercent}%` }}
                        />
                        {forecastedPercent > 0 && (
                          <div
                            className={`${willBeOver ? 'bg-red-300' : 'bg-primary/40'} transition-all`}
                            style={{ width: `${forecastedPercent}%` }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Savings Goals */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Savings Goals</h2>
              <p className="text-sm text-muted-foreground">
                {formatCents(totalSaved)} saved of {formatCents(totalTarget)} target
              </p>
            </div>
          </div>

          {savingsGoals.length === 0 ? (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              No savings goals yet.{' '}
              <Link to="/savings/new" className="text-primary underline">
                Create one
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {savingsGoals.map((goal) => {
                const savedAmount = savingsTransactions
                  .filter((t) => t.savingsGoalId === goal.id)
                  .reduce((sum, t) => sum + t.amountCents, 0);
                const forecastedAmount = savingsForecasts
                  .filter((f) => f.savingsGoalId === goal.id)
                  .reduce((sum, f) => sum + f.amountCents, 0);
                const actualPercent =
                  goal.targetAmountCents > 0
                    ? Math.min(100, (savedAmount / goal.targetAmountCents) * 100)
                    : 0;
                const forecastedPercent =
                  goal.targetAmountCents > 0
                    ? Math.min(100 - actualPercent, (forecastedAmount / goal.targetAmountCents) * 100)
                    : 0;
                return (
                  <div key={goal.id}>
                    <div className="flex justify-between text-sm">
                      <Link to={`/savings/${goal.id}`} className="font-medium hover:underline">
                        {goal.name}
                        {goal.periodId === null && (
                          <span className="ml-1 text-xs text-muted-foreground">(Global)</span>
                        )}
                      </Link>
                      <span className="text-muted-foreground">
                        {formatCents(savedAmount)} / {formatCents(goal.targetAmountCents)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div className="flex h-full">
                        <div
                          className="bg-blue-600 transition-all"
                          style={{ width: `${actualPercent}%` }}
                        />
                        {forecastedPercent > 0 && (
                          <div
                            className="bg-blue-300 transition-all"
                            style={{ width: `${forecastedPercent}%` }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
