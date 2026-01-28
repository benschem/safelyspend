import { useMemo, useState, useEffect } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { ChartSpline } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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
  CashFlowChart,
  SavingsOverTimeChart,
  SavingsGoalChart,
} from '@/components/charts';
import { ScenarioSelector } from '@/components/scenario-selector';

interface OutletContext {
  activeScenarioId: string | null;
}

const VALID_TABS = ['cashflow', 'spending', 'savings'] as const;
type TabValue = (typeof VALID_TABS)[number];
const STORAGE_KEY = 'budget:reportsTab';

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

  // Tab state: localStorage persists selection, URL param overrides for direct links
  const [activeTab, setActiveTab] = useState<TabValue>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as TabValue | null;
    if (stored && VALID_TABS.includes(stored)) return stored;
    return 'cashflow';
  });

  // Handle URL param override (for direct links from dashboard)
  const urlTab = searchParams.get('tab') as TabValue | null;
  useEffect(() => {
    if (urlTab && VALID_TABS.includes(urlTab)) {
      setActiveTab(urlTab);
      localStorage.setItem(STORAGE_KEY, urlTab);
      // Clear URL param after applying
      setSearchParams({}, { replace: true });
    }
  }, [urlTab, setSearchParams]);

  const handleTabChange = (value: string) => {
    const tab = value as TabValue;
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
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
      <div className="mb-20 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <ChartSpline className="h-7 w-7" />
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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            <TabsTrigger value="spending">Spending</TabsTrigger>
            <TabsTrigger value="savings">Savings</TabsTrigger>
          </TabsList>
          <ScenarioSelector />
        </div>

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

        {/* Cash Flow Tab - Income vs expenses over time */}
        <TabsContent value="cashflow" className="mt-6">
          <div className="space-y-4">
            {startingBalance === null && (
              <Alert variant="warning">
                <AlertTitle>No balance anchor set</AlertTitle>
                <AlertDescription>
                  Set a starting balance in{' '}
                  <Link to="/settings" className="underline">
                    Settings
                  </Link>{' '}
                  to see your bank balance over time.
                </AlertDescription>
              </Alert>
            )}
            <div className="rounded-lg border p-6">
              <div>
                <h2 className="text-lg font-semibold">Cash Flow</h2>
                <p className="text-sm text-muted-foreground">
                  {isPastOnly
                    ? 'Past income, expenses, and savings'
                    : isFutureOnly
                      ? 'Forecasted monthly income, expenses, and savings'
                      : 'Income, expenses and savings'}
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
