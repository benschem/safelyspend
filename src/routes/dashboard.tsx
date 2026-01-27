import { useMemo } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useScenarios } from '@/hooks/use-scenarios';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useCategories } from '@/hooks/use-categories';
import { formatCents, formatDate } from '@/lib/utils';
import { buildCategoryColorMap } from '@/lib/chart-colors';
import { SpendingBreakdownChart, SavingsDonutChart, BudgetDonutChart } from '@/components/charts';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

const VALID_TABS = ['current', 'forecast', 'budget', 'savings'] as const;
type TabValue = (typeof VALID_TABS)[number];

export function DashboardPage() {
  const { activeScenarioId, startDate, endDate } = useOutletContext<OutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = (searchParams.get('tab') as TabValue) || 'current';
  const activeTab = VALID_TABS.includes(currentTab) ? currentTab : 'current';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };
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

  // Calculate buffer end date with edge case handling
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const sevenDaysDate = sevenDaysFromNow.toISOString().slice(0, 10);

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysDate = thirtyDaysFromNow.toISOString().slice(0, 10);
  const defaultBufferEnd = thirtyDaysDate < endDate ? thirtyDaysDate : endDate;

  let bufferEndDate: string;
  let bufferDescription: string;

  if (!nextIncomeDate) {
    // No income forecast - use 30 days
    bufferEndDate = defaultBufferEnd;
    bufferDescription = 'Next 30 days';
  } else if (nextIncomeDate <= sevenDaysDate) {
    // Next income is within 7 days - extend to the income after that
    const incomeAfterNext = sortedFutureIncome.find((f) => f.date > nextIncomeDate);
    if (incomeAfterNext) {
      bufferEndDate = incomeAfterNext.date;
      bufferDescription = `Until payment on ${formatDate(incomeAfterNext.date)}`;
    } else {
      bufferEndDate = defaultBufferEnd;
      bufferDescription = 'Next 30 days';
    }
  } else {
    bufferEndDate = nextIncomeDate;
    bufferDescription = `Until payment on ${formatDate(nextIncomeDate)}`;
  }

  // Sum expenses and savings between now and buffer end date
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

  // Build shared color map for all categories so both charts use consistent colors
  const categoryColorMap = useMemo(
    () => buildCategoryColorMap(activeCategories.map((c) => c.id)),
    [activeCategories],
  );

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your finances</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="current" className="flex-1 min-w-fit">Current</TabsTrigger>
          <TabsTrigger value="forecast" className="flex-1 min-w-fit">Forecast</TabsTrigger>
          <TabsTrigger value="budget" className="flex-1 min-w-fit">Budget</TabsTrigger>
          <TabsTrigger value="savings" className="flex-1 min-w-fit">Savings</TabsTrigger>
        </TabsList>

        {/* Current Position Tab */}
        <TabsContent value="current" className="mt-6">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <p className="text-sm text-muted-foreground">{bufferDescription}</p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Available to Spend</p>
                <p
                  className={`text-2xl font-bold ${cashFlowBuffer < 0 ? 'text-red-600' : 'text-green-600'}`}
                >
                  {formatCents(cashFlowBuffer)}
                </p>
                <p className="text-sm text-muted-foreground">{bufferDescription}</p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total Savings</p>
                <p className="text-2xl font-bold text-blue-600">{formatCents(actualSavings)}</p>
                <p className="text-sm text-blue-600">+{formatCents(actualSavings)} this period</p>
              </div>
            </div>

            {/* Spending Breakdown */}
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold">Spending Breakdown</h2>
              <p className="text-sm text-muted-foreground">
                How you spent {formatCents(actualBreakdown.total)} income from {formatDate(startDate)} until {formatDate(endDate)}
              </p>

              {actualBreakdown.total === 0 ? (
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  No income recorded yet.
                </div>
              ) : (
                <div className="mt-4">
                  <SpendingBreakdownChart
                    segments={actualBreakdown.segments}
                    total={actualBreakdown.total}
                    colorMap={categoryColorMap}
                  />
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Forecast Tab */}
        <TabsContent value="forecast" className="mt-6">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Forecast Balance</p>
                <p className={`text-2xl font-bold ${projectedEndBalance < 0 ? 'text-red-600' : ''}`}>
                  {formatCents(projectedEndBalance)}
                </p>
                <p className={`text-sm ${forecastedNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {forecastedNet >= 0 ? '+' : ''}
                  {formatCents(forecastedNet)}
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Expected Income</p>
                <p className="text-2xl font-bold text-green-600">+{formatCents(forecastedIncome)}</p>
                <p className="text-sm text-muted-foreground">
                  {futureIncomeForecasts.length} {futureIncomeForecasts.length === 1 ? 'payment' : 'payments'}
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Expected Expenses</p>
                <p className="text-2xl font-bold text-red-600">
                  -{formatCents(forecastedExpenses)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {futureExpenseForecasts.length} {futureExpenseForecasts.length === 1 ? 'expense' : 'expenses'}
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Planned Savings</p>
                <p className="text-2xl font-bold text-blue-600">
                  +{formatCents(forecastedSavings)}
                </p>
                <p className="text-sm text-blue-600">
                  {actualSavings > 0
                    ? `+${Math.round((forecastedSavings / actualSavings) * 100)}%`
                    : `${futureSavingsForecasts.length} contributions`}
                </p>
              </div>
            </div>

            {/* Forecast Spending Breakdown */}
            {forecastBreakdown.total > 0 && (
              <div className="rounded-lg border p-4">
                <h3 className="text-lg font-semibold">Forecast Spending</h3>
                <p className="text-sm text-muted-foreground">
                  How {formatCents(forecastBreakdown.total)} expected income will be allocated from now until {formatDate(endDate)}
                </p>

                <div className="mt-4">
                  <SpendingBreakdownChart
                    segments={forecastBreakdown.segments}
                    total={forecastBreakdown.total}
                    colorMap={categoryColorMap}
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Budget Tab */}
        <TabsContent value="budget" className="mt-6">
          <div className="rounded-lg border p-4">
            <h2 className="text-lg font-semibold">Budget Tracking</h2>
            {budgetRows.length === 0 ? (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                No budget set.{' '}
                <Link to="/budget" className="text-primary underline">
                  Set budgets
                </Link>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
                {budgetRows.map((row) => (
                  <BudgetDonutChart
                    key={row.id}
                    categoryName={row.name}
                    budgeted={row.budgeted}
                    actual={row.actual}
                    forecasted={row.forecasted}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Savings Tab */}
        <TabsContent value="savings" className="mt-6">
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
              <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
                {savingsGoals.map((goal) => {
                  const savedAmount = savingsTransactions
                    .filter((t) => t.savingsGoalId === goal.id)
                    .reduce((sum, t) => sum + t.amountCents, 0);
                  const forecastedAmount = savingsForecasts
                    .filter((f) => f.savingsGoalId === goal.id)
                    .reduce((sum, f) => sum + f.amountCents, 0);
                  return (
                    <SavingsDonutChart
                      key={goal.id}
                      goalId={goal.id}
                      goalName={goal.name}
                      targetAmount={goal.targetAmountCents}
                      savedAmount={savedAmount}
                      forecastedAmount={forecastedAmount}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
