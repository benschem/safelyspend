import { useMemo, useState, useEffect } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { ChartSpline } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useReportsData } from '@/hooks/use-reports-data';
import { useViewState } from '@/hooks/use-view-state';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { useTransactions } from '@/hooks/use-transactions';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { buildCategoryColorMap } from '@/lib/chart-colors';
import { formatCompactDate } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TimelineRangePicker } from '@/components/timeline-range-picker';
import {
  BudgetComparisonChart,
  CashFlowChart,
  SavingsOverTimeChart,
} from '@/components/charts';
import { ScenarioSelector } from '@/components/scenario-selector';

interface OutletContext {
  activeScenarioId: string | null;
}

const VALID_TABS = ['cashflow', 'spending', 'savings'] as const;
type TabValue = (typeof VALID_TABS)[number];
const STORAGE_KEY = 'budget:reportsTab';
const SAVINGS_VIEW_KEY = 'budget:savingsChartView';

export function InsightsPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    mode,
    amount,
    unit,
    lastPresetMode,
    startDate,
    endDate,
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
    }
  }, [urlTab]);

  const handleTabChange = (value: string) => {
    const tab = value as TabValue;
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
    setSearchParams({ tab }, { replace: true });
  };

  // Savings chart view state: 'total', 'dedicated', or a specific goal ID
  const [savingsView, setSavingsView] = useState<string>(() => {
    return localStorage.getItem(SAVINGS_VIEW_KEY) ?? 'total';
  });

  const handleSavingsViewChange = (value: string) => {
    setSavingsView(value);
    localStorage.setItem(SAVINGS_VIEW_KEY, value);
  };

  // Get emergency fund info for dedicated savings calculation
  const { emergencyFund } = useSavingsGoals();

  const {
    isLoading,
    monthlyBudgetComparison,
    budgetCategories,
    monthlyNetFlow,
    monthlySavings,
    savingsByGoal,
  } = useReportsData(activeScenarioId, startDate, endDate);

  // Validate savingsView - must be 'total', 'dedicated', or a valid goal ID
  const validGoalIds = useMemo(() => savingsByGoal.map((g) => g.goalId), [savingsByGoal]);
  const effectiveSavingsView = useMemo(() => {
    if (savingsView === 'total' || savingsView === 'dedicated') return savingsView;
    if (validGoalIds.includes(savingsView)) return savingsView;
    return 'total'; // Default to total if invalid
  }, [savingsView, validGoalIds]);

  // Update localStorage if we had to correct an invalid value
  useEffect(() => {
    if (effectiveSavingsView !== savingsView) {
      localStorage.setItem(SAVINGS_VIEW_KEY, effectiveSavingsView);
    }
  }, [effectiveSavingsView, savingsView]);

  // Calculate dedicated savings (total minus emergency fund)
  const dedicatedSavings = useMemo(() => {
    if (!emergencyFund) return monthlySavings; // No emergency fund, dedicated = total

    const emergencyGoalData = savingsByGoal.find((g) => g.goalId === emergencyFund.id);
    if (!emergencyGoalData) return monthlySavings;

    // Subtract emergency fund from total for each month
    return monthlySavings.map((month, i) => {
      const emergencyMonth = emergencyGoalData.monthlySavings[i];
      return {
        ...month,
        actual: month.actual - (emergencyMonth?.actual ?? 0),
        forecast: month.forecast - (emergencyMonth?.forecast ?? 0),
        cumulativeActual: month.cumulativeActual - (emergencyMonth?.cumulativeActual ?? 0),
        cumulativeForecast: month.cumulativeForecast - (emergencyMonth?.cumulativeForecast ?? 0),
      };
    });
  }, [monthlySavings, savingsByGoal, emergencyFund]);

  // Build a shared colour map so categories have consistent colours across all charts
  const allCategoryIds = useMemo(() => {
    return budgetCategories.map((c) => c.id);
  }, [budgetCategories]);

  const categoryColorMap = useMemo(
    () => buildCategoryColorMap(allCategoryIds),
    [allCategoryIds],
  );

  // Determine if viewing past period
  const today = new Date().toISOString().slice(0, 10);
  const isPastOnly = endDate <= today;

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
          title: `Cash shown only from ${formatCompactDate(anchorInRange.date, true)}`,
          linkText: 'Add an earlier starting cash',
          linkSuffix: 'to see cash from the start of this period.',
        },
      };
    }

    // No anchors at all for this period
    return {
      startingBalance: null,
      balanceStartMonth: null,
      warning: {
        title: 'No starting cash set for this period',
        linkText: 'Add your starting cash',
        linkSuffix: 'to see your cash over time.',
      },
    };
  }, [getActiveAnchor, anchors, allTransactions, startDate, endDate]);

  return (
    <div className="page-shell space-y-6">
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">
          <div className="page-title-icon bg-slate-500/10">
            <ChartSpline className="h-5 w-5 text-slate-500" />
          </div>
          Insights
        </h1>
        <p className="page-description">Understand your financial patterns</p>
      </div>

      {/* Controls row: Segment + Date range + Scenario */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Segmented control */}
        <div className="inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground">
          {[
            { value: 'cashflow', label: 'Cash Flow' },
            { value: 'spending', label: 'Spending' },
            { value: 'savings', label: 'Savings' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTabChange(tab.value)}
              className={cn(
                'inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all',
                activeTab === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          <TimelineRangePicker
            mode={mode}
            amount={amount}
            unit={unit}
            lastPresetMode={lastPresetMode}
            startDate={startDate}
            endDate={endDate}
            onModeChange={setMode}
            onAmountChange={setAmount}
            onUnitChange={setUnit}
            onCustomDateChange={setCustomDateRange}
          />
          <ScenarioSelector />
        </div>
      </div>

      {/* Content sections */}
      {isLoading ? (
        <PageLoading />
      ) : activeTab === 'spending' ? (
        <div className="space-y-6">
          <div className="flex min-h-9 items-center">
            <p className="text-sm text-muted-foreground">
              {isPastOnly
                ? 'How your spending compared to your budget'
                : 'Actual and forecast spending vs budget'}
            </p>
          </div>
          <BudgetComparisonChart
            monthlyBudgetComparison={monthlyBudgetComparison}
            budgetCategories={budgetCategories}
            colorMap={categoryColorMap}
          />
        </div>
      ) : activeTab === 'cashflow' ? (
        <div className="space-y-6">
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
          <div className="flex min-h-9 items-center">
            <p className="text-sm text-muted-foreground">
              {isPastOnly
                ? 'Your cash and monthly income vs expenses'
                : 'Cash and savings over time, including planned income, spending and saving'}
            </p>
          </div>
          <CashFlowChart
            monthlyNetFlow={monthlyNetFlow}
            startingBalance={balanceInfo.startingBalance}
            balanceStartMonth={balanceInfo.balanceStartMonth}
          />
        </div>
      ) : activeTab === 'savings' ? (
        <div className="space-y-6">
          <div className="flex min-h-9 items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {isPastOnly
                ? 'Cumulative savings contributions'
                : 'Saved so far, plus planned contributions'}
            </p>
            {savingsByGoal.length > 0 && (
              <Select value={effectiveSavingsView} onValueChange={handleSavingsViewChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Total Savings</SelectItem>
                  {emergencyFund && (
                    <SelectItem value="dedicated">Dedicated Savings</SelectItem>
                  )}
                  {savingsByGoal.map((goal) => (
                    <SelectItem key={goal.goalId} value={goal.goalId}>
                      {goal.goalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {effectiveSavingsView === 'total' ? (
            <SavingsOverTimeChart monthlySavings={monthlySavings} />
          ) : effectiveSavingsView === 'dedicated' ? (
            <SavingsOverTimeChart monthlySavings={dedicatedSavings} />
          ) : (
            <SavingsOverTimeChart
              monthlySavings={
                savingsByGoal.find((g) => g.goalId === effectiveSavingsView)?.monthlySavings ?? []
              }
              deadline={savingsByGoal.find((g) => g.goalId === effectiveSavingsView)?.deadline}
              targetAmount={savingsByGoal.find((g) => g.goalId === effectiveSavingsView)?.targetAmount}
              startingBalance={savingsByGoal.find((g) => g.goalId === effectiveSavingsView)?.startingBalance}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
