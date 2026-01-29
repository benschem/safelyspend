import { useMemo, useState, useEffect } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { ChartSpline } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useReportsData } from '@/hooks/use-reports-data';
import { useViewState } from '@/hooks/use-view-state';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { useTransactions } from '@/hooks/use-transactions';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { buildCategoryColorMap } from '@/lib/chart-colors';
import { formatCompactDate, formatISODate } from '@/lib/utils';
import type { Cadence } from '@/lib/types';
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
  SavingsGoalProgressCard,
  BurnRateChart,
} from '@/components/charts';
import { ScenarioSelector } from '@/components/scenario-selector';

interface OutletContext {
  activeScenarioId: string | null;
}

const VALID_TABS = ['cashflow', 'spending', 'pace', 'savings'] as const;
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
  const { budgetRules } = useBudgetRules(activeScenarioId);

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

  // Burn rate data - calculate current period based on cadence
  const [burnRateCadence, setBurnRateCadence] = useState<Cadence>('monthly');

  const burnRateData = useMemo(() => {
    // Calculate period range for selected cadence
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;
    let periodLabel: string;

    switch (burnRateCadence) {
      case 'weekly': {
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() + diffToMonday);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 6);
        periodLabel = 'This Week';
        break;
      }
      case 'fortnightly': {
        const epoch = new Date('2024-01-01');
        const diffDays = Math.floor((now.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
        const fortnightNumber = Math.floor(diffDays / 14);
        periodStart = new Date(epoch);
        periodStart.setDate(periodStart.getDate() + fortnightNumber * 14);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 13);
        periodLabel = 'This Fortnight';
        break;
      }
      case 'monthly': {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        periodLabel = now.toLocaleDateString('en-AU', { month: 'long' });
        break;
      }
      case 'quarterly': {
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        periodStart = new Date(now.getFullYear(), quarterStart, 1);
        periodEnd = new Date(now.getFullYear(), quarterStart + 3, 0);
        const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4'];
        periodLabel = `${quarterNames[Math.floor(quarterStart / 3)]} ${now.getFullYear()}`;
        break;
      }
      case 'yearly': {
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodEnd = new Date(now.getFullYear(), 11, 31);
        periodLabel = `${now.getFullYear()}`;
        break;
      }
    }

    const startStr = formatISODate(periodStart);
    const endStr = formatISODate(periodEnd);

    // Get daily expense spending within this period
    const expenses = allTransactions.filter(
      (t) => t.type === 'expense' && t.date >= startStr && t.date <= endStr,
    );

    const dailySpending = expenses.map((t) => ({
      date: t.date,
      amount: t.amountCents,
    }));

    // Calculate total budget for this cadence
    const totalBudget = budgetRules
      .filter((r) => r.cadence === burnRateCadence)
      .reduce((sum, r) => sum + r.amountCents, 0);

    return {
      dailySpending,
      totalBudget,
      periodStart: startStr,
      periodEnd: endStr,
      periodLabel,
    };
  }, [allTransactions, budgetRules, burnRateCadence]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500/10">
            <ChartSpline className="h-5 w-5 text-slate-500" />
          </div>
          Insights
        </h1>
        <p className="mt-1 text-muted-foreground">Understand your financial patterns</p>
      </div>

      {/* Controls row: Segment + Date range + Scenario */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Segmented control */}
        <div className="inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground">
          {[
            { value: 'cashflow', label: 'Cash Flow' },
            { value: 'spending', label: 'Spending' },
            { value: 'pace', label: 'Pace' },
            { value: 'savings', label: 'Savings' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTabChange(tab.value)}
              className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all',
                activeTab === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:text-foreground'
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
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onModeChange={setMode}
            onAmountChange={setAmount}
            onUnitChange={setUnit}
            onCustomDateChange={setCustomDateRange}
          />
          <ScenarioSelector />
        </div>
      </div>

      {/* Content sections */}
      {activeTab === 'spending' && (
        <BudgetComparisonChart
          monthlyBudgetComparison={monthlyBudgetComparison}
          budgetCategories={budgetCategories}
          colorMap={categoryColorMap}
        />
      )}

      {activeTab === 'pace' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Select value={burnRateCadence} onValueChange={(v) => setBurnRateCadence(v as Cadence)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="fortnightly">Fortnightly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <BurnRateChart
            dailySpending={burnRateData.dailySpending}
            totalBudget={burnRateData.totalBudget}
            periodStart={burnRateData.periodStart}
            periodEnd={burnRateData.periodEnd}
            periodLabel={burnRateData.periodLabel}
          />
        </div>
      )}

      {activeTab === 'cashflow' && (
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
          <CashFlowChart
            monthlyNetFlow={monthlyNetFlow}
            startingBalance={balanceInfo.startingBalance}
            balanceStartMonth={balanceInfo.balanceStartMonth}
          />
        </div>
      )}

      {activeTab === 'savings' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {isPastOnly
                ? 'Cumulative savings contributions'
                : 'Solid line is actual, dashed line is forecasted'}
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

          {savingsByGoal.length > 0 && (
            <div className="mt-4 border-t pt-6">
              <h3 className="text-base font-semibold">Progress by Goal</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Track progress towards each savings goal
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {savingsByGoal.map((goal) => (
                  <SavingsGoalProgressCard
                    key={goal.goalId}
                    goalName={goal.goalName}
                    targetAmount={goal.targetAmount}
                    currentBalance={goal.currentBalance}
                    deadline={goal.deadline}
                    annualInterestRate={goal.annualInterestRate}
                    monthlySavings={goal.monthlySavings}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
