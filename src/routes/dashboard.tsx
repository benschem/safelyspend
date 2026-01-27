import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { useScenarios } from '@/hooks/use-scenarios';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useCategories } from '@/hooks/use-categories';
import { formatCents, formatDate } from '@/lib/utils';
import { SpendingBreakdownChart } from '@/components/charts';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}


export function DashboardPage() {
  const { activeScenarioId, startDate, endDate } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { incomeTransactions, expenseTransactions, savingsTransactions, adjustmentTransactions } =
    useTransactions(startDate, endDate);
  const { incomeForecasts, expenseForecasts, savingsForecasts } = useForecasts(
    activeScenarioId,
    startDate,
    endDate,
  );
  const { savingsGoals } = useSavingsGoals();
  const { getBudgetForCategory } = useBudgetRules(activeScenarioId, startDate, endDate);
  const { activeCategories } = useCategories();

  // Calculate totals - opening balance from adjustment transactions
  const totalOpeningBalance = adjustmentTransactions.reduce(
    (sum, t) => sum + t.amountCents,
    0,
  );

  const actualIncome = incomeTransactions.reduce((sum, t) => sum + t.amountCents, 0);
  const actualExpenses = expenseTransactions.reduce((sum, t) => sum + t.amountCents, 0);
  const actualSavings = savingsTransactions.reduce((sum, t) => sum + t.amountCents, 0);
  const actualNet = actualIncome - actualExpenses - actualSavings;

  const currentBalance = totalOpeningBalance + actualNet;

  // Filter forecasts to only include future dates (avoid double-counting with actuals)
  const today = new Date().toISOString().slice(0, 10);
  const futureIncomeForecasts = incomeForecasts.filter((f) => f.date > today);
  const futureExpenseForecasts = expenseForecasts.filter((f) => f.date > today);
  const futureSavingsForecasts = savingsForecasts.filter((f) => f.date > today);

  const forecastedIncome = futureIncomeForecasts.reduce((sum, f) => sum + f.amountCents, 0);
  const forecastedExpenses = futureExpenseForecasts.reduce((sum, f) => sum + f.amountCents, 0);
  const forecastedSavings = futureSavingsForecasts.reduce((sum, f) => sum + f.amountCents, 0);
  const forecastedNet = forecastedIncome - forecastedExpenses - forecastedSavings;

  const projectedEndBalance = currentBalance + forecastedNet;

  // Calculate cash flow buffer (money available until next income)
  const sortedFutureIncome = [...futureIncomeForecasts].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const nextIncomeDate = sortedFutureIncome[0]?.date ?? null;
  const bufferEndDate = nextIncomeDate ?? endDate;

  // Sum expenses and savings between now and next income (or period end)
  const committedBeforeNextIncome = [
    ...futureExpenseForecasts.filter((f) => f.date <= bufferEndDate),
    ...futureSavingsForecasts.filter((f) => f.date <= bufferEndDate),
  ].reduce((sum, f) => sum + f.amountCents, 0);

  const cashFlowBuffer = currentBalance - committedBeforeNextIncome;


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
    for (const f of futureExpenseForecasts) {
      if (f.categoryId) {
        forecasted[f.categoryId] = (forecasted[f.categoryId] ?? 0) + f.amountCents;
      }
    }
    return forecasted;
  }, [futureExpenseForecasts]);

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

  // Calculate actual spending breakdown by category
  const actualBreakdown = useMemo(() => {
    const segments: Array<{ id: string; name: string; amount: number }> = [];

    // Add category spending
    for (const category of activeCategories) {
      const amount = spendingByCategory[category.id] ?? 0;
      if (amount > 0) {
        segments.push({
          id: category.id,
          name: category.name,
          amount,
        });
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
      });
    }

    // Add savings
    if (actualSavings > 0) {
      segments.push({
        id: 'savings',
        name: 'Savings',
        amount: actualSavings,
      });
    }

    // Add unallocated (remaining from income)
    const totalAllocated = segments.reduce((sum, s) => sum + s.amount, 0);
    const unallocated = actualIncome - totalAllocated;
    if (unallocated > 0) {
      segments.push({
        id: 'unallocated',
        name: 'Available',
        amount: unallocated,
      });
    }

    return { segments, total: actualIncome };
  }, [activeCategories, spendingByCategory, expenseTransactions, actualSavings, actualIncome]);

  // Calculate forecast breakdown by category (future only)
  const forecastBreakdown = useMemo(() => {
    const segments: Array<{ id: string; name: string; amount: number }> = [];

    // Build forecast spending by category
    const forecastByCategory: Record<string, number> = {};
    for (const f of futureExpenseForecasts) {
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
        });
      }
    }

    // Add uncategorized forecast expenses
    const uncategorizedForecasts = futureExpenseForecasts
      .filter((f) => !f.categoryId)
      .reduce((sum, f) => sum + f.amountCents, 0);
    if (uncategorizedForecasts > 0) {
      segments.push({
        id: 'uncategorized',
        name: 'Uncategorized',
        amount: uncategorizedForecasts,
      });
    }

    // Add savings
    if (forecastedSavings > 0) {
      segments.push({
        id: 'savings',
        name: 'Savings',
        amount: forecastedSavings,
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
      });
    }

    return { segments, total: forecastedIncome };
  }, [activeCategories, futureExpenseForecasts, forecastedSavings, forecastedIncome]);

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No scenario selected</h2>
        <p className="text-muted-foreground">Create a scenario to get started.</p>
        <Button asChild className="mt-4">
          <Link to="/manage/scenarios/new">Create Scenario</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Current Position */}
      <section>
        <h1 className="text-2xl font-bold">Current Position</h1>
        <p className="text-muted-foreground">Your money right now</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Bank Balance</p>
            <p className="text-2xl font-bold">{formatCents(currentBalance)}</p>
            {totalOpeningBalance !== 0 && (
              <p className={`text-sm ${actualNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {actualNet >= 0 ? '+' : ''}
                {formatCents(actualNet)} this period
              </p>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Allocated Funds</p>
            <p className="text-2xl font-bold">{formatCents(committedBeforeNextIncome)}</p>
            <p className="text-sm text-muted-foreground">
              Due before next pay
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Available to Spend</p>
            <p className={`text-2xl font-bold ${cashFlowBuffer < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCents(cashFlowBuffer)}
            </p>
            <p className="text-sm text-muted-foreground">
              {nextIncomeDate ? `Until ${formatDate(nextIncomeDate)}` : 'No upcoming income'}
            </p>
          </div>
        </div>

        {/* Spending Breakdown */}
        <div className="mt-4 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Spending Breakdown</h2>
          <p className="text-sm text-muted-foreground">
            How you spent {formatCents(actualBreakdown.total)} income this period
          </p>

          {actualBreakdown.total === 0 ? (
            <div className="mt-4 text-center text-sm text-muted-foreground">No income recorded yet.</div>
          ) : (
            <div className="mt-4">
              <SpendingBreakdownChart
                segments={actualBreakdown.segments}
                total={actualBreakdown.total}
              />
            </div>
          )}
        </div>
      </section>

      {/* Forecast Position */}
      <section>
        <h2 className="text-xl font-bold">Forecast</h2>
        <p className="text-muted-foreground">
          Projected to {formatDate(endDate)}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Projected Balance</p>
            <p className={`text-2xl font-bold ${projectedEndBalance < 0 ? 'text-red-600' : ''}`}>
              {formatCents(projectedEndBalance)}
            </p>
            <p className={`text-sm ${forecastedNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {forecastedNet >= 0 ? '+' : ''}{formatCents(forecastedNet)} forecast
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Expected Income</p>
            <p className="text-2xl font-bold text-green-600">+{formatCents(forecastedIncome)}</p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Expected Expenses</p>
            <p className="text-2xl font-bold text-red-600">-{formatCents(forecastedExpenses)}</p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Planned Savings</p>
            <p className="text-2xl font-bold text-blue-600">-{formatCents(forecastedSavings)}</p>
          </div>
        </div>

        {/* Forecast Spending Breakdown */}
        {forecastBreakdown.total > 0 && (
          <div className="mt-4 rounded-lg border p-4">
            <h3 className="text-lg font-semibold">Forecast Spending</h3>
            <p className="text-sm text-muted-foreground">
              How {formatCents(forecastBreakdown.total)} expected income will be allocated
            </p>

            <div className="mt-4">
              <SpendingBreakdownChart
                segments={forecastBreakdown.segments}
                total={forecastBreakdown.total}
              />
            </div>
          </div>
        )}
      </section>

      {/* Budget & Savings */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Budget Tracking */}
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Budget</h2>
          {budgetRows.length === 0 ? (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              No budget set.{' '}
              <Link to="/budget" className="text-primary underline">
                Set budgets
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {budgetRows.map((row) => {
                const spentPercent =
                  row.budgeted > 0 ? Math.min(100, (row.actual / row.budgeted) * 100) : 0;
                const forecastedPercent =
                  row.budgeted > 0
                    ? Math.min(100 - spentPercent, (row.forecasted / row.budgeted) * 100)
                    : 0;
                const isOver = row.actual > row.budgeted;
                const willBeOver = row.actual + row.forecasted > row.budgeted;
                return (
                  <div key={row.id}>
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">{row.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCents(row.budgeted)} budget
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div className="flex h-full">
                        <div
                          className={`${isOver ? 'bg-red-600' : 'bg-primary'} transition-all`}
                          style={{ width: `${spentPercent}%` }}
                        />
                        {forecastedPercent > 0 && (
                          <div
                            className={`${willBeOver ? 'bg-red-300' : 'bg-primary/40'} transition-all`}
                            style={{ width: `${forecastedPercent}%` }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span className={isOver ? 'text-red-600' : ''}>
                        {formatCents(row.actual)} spent
                      </span>
                      <span className={row.remaining < 0 ? 'text-red-600' : ''}>
                        {formatCents(Math.abs(row.remaining))} {row.remaining >= 0 ? 'remaining' : 'over'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Savings Goals */}
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Savings Goals</h2>
          {savingsGoals.length === 0 ? (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              No savings goals yet.{' '}
              <Link to="/savings/new" className="text-primary underline">
                Create one
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
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
                const remaining = goal.targetAmountCents - savedAmount;
                return (
                  <div key={goal.id}>
                    <div className="flex items-baseline justify-between">
                      <Link to={`/savings/${goal.id}`} className="font-medium hover:underline">
                        {goal.name}
                      </Link>
                      <span className="text-sm text-muted-foreground">
                        {formatCents(goal.targetAmountCents)} goal
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
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>{formatCents(savedAmount)} saved</span>
                      <span>{formatCents(remaining)} to go</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
