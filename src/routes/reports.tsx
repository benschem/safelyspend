import { useMemo } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { AlertCircle, BarChart3 } from 'lucide-react';
import { useReportsData } from '@/hooks/use-reports-data';
import { useViewState } from '@/hooks/use-view-state';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { useTransactions } from '@/hooks/use-transactions';
import { buildCategoryColorMap } from '@/lib/chart-colors';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TimelinePicker } from '@/components/timeline-picker';
import { StickyDateBar } from '@/components/sticky-date-bar';
import {
  BudgetComparisonChart,
  BudgetHealthTable,
  CashFlowChart,
  SavingsOverTimeChart,
  SavingsGoalChart,
} from '@/components/charts';
import { ScenarioSelector } from '@/components/scenario-selector';

interface OutletContext {
  activeScenarioId: string | null;
}

const VALID_TABS = ['spending', 'health', 'cashflow', 'savings'] as const;
type TabValue = (typeof VALID_TABS)[number];

export function ReportsPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    mode,
    zoomLevel,
    startDate,
    endDate,
    customStartDate,
    customEndDate,
    setMode,
    setZoomLevel,
    setCustomDateRange,
  } = useViewState();

  const currentTab = (searchParams.get('tab') as TabValue) || 'spending';
  const activeTab = VALID_TABS.includes(currentTab) ? currentTab : 'spending';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };
  const {
    monthlyBudgetComparison,
    budgetCategories,
    monthlyNetFlow,
    monthlySavings,
    savingsByGoal,
  } = useReportsData(activeScenarioId, startDate, endDate);

  // Build a shared colour map so categories have consistent colours across all charts
  const allCategoryIds = useMemo(() => {
    return budgetCategories.map((c) => c.id);
  }, [budgetCategories]);

  const categoryColorMap = useMemo(
    () => buildCategoryColorMap(allCategoryIds),
    [allCategoryIds],
  );

  // Determine if viewing past, future, or mixed period
  const today = new Date().toISOString().slice(0, 10);
  const isPastOnly = endDate <= today;
  const isFutureOnly = startDate > today;
  const isMixed = !isPastOnly && !isFutureOnly;

  // Calculate starting balance for cash flow chart
  const { getActiveAnchor } = useBalanceAnchors();
  const { allTransactions } = useTransactions();

  const startingBalance = useMemo(() => {
    // Get anchor that applies at the start of the report period
    const anchor = getActiveAnchor(startDate);
    if (!anchor) return null;

    // Sum transactions from anchor date up to (but not including) startDate
    const transactionsBeforePeriod = allTransactions.filter(
      (t) => t.date >= anchor.date && t.date < startDate,
    );

    let balance = anchor.balanceCents;
    for (const t of transactionsBeforePeriod) {
      if (t.type === 'income' || t.type === 'adjustment') {
        balance += t.amountCents;
      } else {
        balance -= t.amountCents;
      }
    }
    return balance;
  }, [getActiveAnchor, allTransactions, startDate]);

  return (
    <div className="space-y-6">
      {/* Sticky date bar - renders via portal to layout header slot */}
      <StickyDateBar startDate={startDate} endDate={endDate} />

      {/* Header row: Title + Timeline controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <BarChart3 className="h-7 w-7" />
            Reports
          </h1>
          <p className="mt-1 text-muted-foreground">Analyse your financial patterns</p>
        </div>
        <TimelinePicker
          mode={mode}
          zoomLevel={zoomLevel}
          startDate={startDate}
          endDate={endDate}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onModeChange={setMode}
          onZoomLevelChange={setZoomLevel}
          onCustomDateChange={setCustomDateRange}
        />
      </div>

      <ScenarioSelector />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="spending">Spending</TabsTrigger>
          <TabsTrigger value="health">Budget Health</TabsTrigger>
          <TabsTrigger value="savings">Savings</TabsTrigger>
        </TabsList>

        {/* Spending Tab - Spending by category with budget comparison */}
        <TabsContent value="spending" className="mt-6">
          <div className="rounded-lg border p-6">
            <div>
              <h2 className="text-lg font-semibold">Spending by Category</h2>
              <p className="text-sm text-muted-foreground">
                Spending compared to budgeted amounts
              </p>
            </div>
            <div className="mt-6">
              <BudgetComparisonChart
                monthlyBudgetComparison={monthlyBudgetComparison}
                budgetCategories={budgetCategories}
                colorMap={categoryColorMap}
              />
            </div>
          </div>
        </TabsContent>

        {/* Budget Health Tab - Proportional budget comparison */}
        <TabsContent value="health" className="mt-6">
          <div className="rounded-lg border p-6">
            <div>
              <h2 className="text-lg font-semibold">Budget Health</h2>
              <p className="text-sm text-muted-foreground">
                {isPastOnly
                  ? 'Based on actual spending'
                  : isFutureOnly
                    ? 'Based on forecasted spending'
                    : 'Combines actual spending with forecasts through the selected period'}
              </p>
            </div>
            <div className="mt-6">
              <BudgetHealthTable
                monthlyBudgetComparison={monthlyBudgetComparison}
                budgetCategories={budgetCategories}
                colorMap={categoryColorMap}
              />
            </div>
          </div>
        </TabsContent>

        {/* Cash Flow Tab - Income vs expenses over time */}
        <TabsContent value="cashflow" className="mt-6">
          <div className="space-y-4">
            {startingBalance === null && (
              <div className="flex items-start gap-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    No balance anchor set
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Set a starting balance in{' '}
                    <Link to="/settings" className="underline">
                      Settings
                    </Link>{' '}
                    to see your bank balance over time.
                  </p>
                </div>
              </div>
            )}
            <div className="rounded-lg border p-6">
              <div>
                <h2 className="text-lg font-semibold">Cash Flow</h2>
                <p className="text-sm text-muted-foreground">
                  {isPastOnly
                    ? 'Monthly income, expenses, and savings'
                    : isFutureOnly
                      ? 'Forecasted monthly income, expenses, and savings'
                      : 'Income vs expenses — solid bars are actual, faded bars are forecasted'}
                </p>
                {isMixed && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Past data shows what happened. Future data shows what&apos;s planned.
                  </p>
                )}
              </div>
              <div className="mt-6">
                <CashFlowChart monthlyNetFlow={monthlyNetFlow} startingBalance={startingBalance} />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Savings Tab - Goal progress */}
        <TabsContent value="savings" className="mt-6">
          <div className="rounded-lg border p-6">
            <div>
              <h2 className="text-lg font-semibold">Savings</h2>
              <p className="text-sm text-muted-foreground">
                {isPastOnly
                  ? 'Cumulative savings contributions'
                  : 'Cumulative savings — solid line is actual, dashed line includes projections'}
              </p>
            </div>

            <div className="mt-6">
              <SavingsOverTimeChart monthlySavings={monthlySavings} />
            </div>

            {savingsByGoal.length > 0 && (
              <div className="mt-8 border-t pt-6">
                <h3 className="text-base font-semibold">Progress by Goal</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Track progress towards each savings goal
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {savingsByGoal.map((goal) => (
                    <SavingsGoalChart
                      key={goal.goalId}
                      goalName={goal.goalName}
                      targetAmount={goal.targetAmount}
                      monthlySavings={goal.monthlySavings}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
