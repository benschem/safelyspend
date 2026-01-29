import { useMemo, useState, useEffect } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { ChartSpline } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useReportsData } from '@/hooks/use-reports-data';
import { useViewState } from '@/hooks/use-view-state';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { useTransactions } from '@/hooks/use-transactions';
import { buildCategoryColorMap } from '@/lib/chart-colors';
import { formatCompactDate } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TimelineRangePicker } from '@/components/timeline-range-picker';
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
    amount,
    unit,
    startDate,
    endDate,
    customStartDate,
    customEndDate,
    setMode,
    setAmount,
    setUnit,
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
  const { getActiveAnchor, anchors } = useBalanceAnchors();
  const { allTransactions } = useTransactions();

  const balanceInfo = useMemo(() => {
    // Get anchor that applies at the start of the report period
    const anchorBeforeStart = getActiveAnchor(startDate);

    // Find first anchor within the date range (if any)
    const anchorInRange = anchors
      .filter((a) => a.date >= startDate && a.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    if (anchorBeforeStart) {
      // We have an anchor before the start - calculate balance from period start
      const transactionsBeforePeriod = allTransactions.filter(
        (t) => t.date >= anchorBeforeStart.date && t.date < startDate,
      );

      let balance = anchorBeforeStart.balanceCents;
      for (const t of transactionsBeforePeriod) {
        if (t.type === 'income' || t.type === 'adjustment') {
          balance += t.amountCents;
        } else {
          balance -= t.amountCents;
        }
      }

      return {
        startingBalance: balance,
        balanceStartMonth: null, // Start from beginning
        warning: null,
      };
    }

    if (anchorInRange) {
      // No anchor before start, but there's one in the range
      // Start balance from that anchor's month
      const anchorMonth = anchorInRange.date.slice(0, 7);

      return {
        startingBalance: anchorInRange.balanceCents,
        balanceStartMonth: anchorMonth,
        warning: {
          title: `Bank balance shown only from ${formatCompactDate(anchorInRange.date, true)}`,
          linkText: 'Set an earlier balance anchor',
          linkSuffix: 'to see your bank balance from the start of this period.',
        },
      };
    }

    // No anchors at all for this period
    return {
      startingBalance: null,
      balanceStartMonth: null,
      warning: {
        title: 'No balance anchor set in this period',
        linkText: 'Set a balance anchor',
        linkSuffix: 'to see your bank balance over time.',
      },
    };
  }, [getActiveAnchor, anchors, allTransactions, startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <ChartSpline className="h-7 w-7" />
          Reports
        </h1>
        <p className="mt-1 text-muted-foreground">Analyse your financial patterns</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="spending">Spending</TabsTrigger>
          <TabsTrigger value="savings">Savings</TabsTrigger>
        </TabsList>

        {/* Context bar: Date range + Scenario */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <TimelineRangePicker
            mode={mode}
            amount={amount}
            unit={unit}
            startDate={startDate}
            endDate={endDate}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onModeChange={setMode}
            onAmountChange={setAmount}
            onUnitChange={setUnit}
            onCustomDateChange={setCustomDateRange}
          />
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
            {balanceInfo.warning && (
              <Alert variant="warning">
                <AlertTitle>{balanceInfo.warning.title}</AlertTitle>
                <AlertDescription>
                  <Link to="/settings" className="underline">
                    {balanceInfo.warning.linkText}
                  </Link>{' '}
                  {balanceInfo.warning.linkSuffix}
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
                <CashFlowChart
                  monthlyNetFlow={monthlyNetFlow}
                  startingBalance={balanceInfo.startingBalance}
                  balanceStartMonth={balanceInfo.balanceStartMonth}
                />
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
