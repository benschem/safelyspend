import { useMemo, useState, useEffect } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { ChartSpline, Wallet, CircleDollarSign, PiggyBank, CircleGauge } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useReportsData } from '@/hooks/use-reports-data';
import { useViewState } from '@/hooks/use-view-state';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { useTransactions } from '@/hooks/use-transactions';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { buildCategoryColorMap } from '@/lib/chart-colors';
import { formatCompactDate, formatISODate } from '@/lib/utils';
import type { Cadence } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

export function AnalysePage() {
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

  // Savings chart view state: 'total' or a specific goal ID
  const [savingsView, setSavingsView] = useState<string>(() => {
    return localStorage.getItem(SAVINGS_VIEW_KEY) ?? 'total';
  });

  const handleSavingsViewChange = (value: string) => {
    setSavingsView(value);
    localStorage.setItem(SAVINGS_VIEW_KEY, value);
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

  // Determine if viewing past or future period
  const today = new Date().toISOString().slice(0, 10);
  const isPastOnly = endDate <= today;
  const isFutureOnly = startDate > today;

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
          <ChartSpline className="h-7 w-7" />
          Analyse
        </h1>
        <p className="mt-1 text-muted-foreground">Analyse your financial patterns</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="spending">Spending</TabsTrigger>
          <TabsTrigger value="pace">Pace</TabsTrigger>
          <TabsTrigger value="savings">Savings</TabsTrigger>
        </TabsList>

        {/* Context bar: Date range + Scenario */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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

        {/* Spending Tab - Spending by category with budget comparison */}
        <TabsContent value="spending" className="mt-6">
          <div className="rounded-lg border p-6">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CircleDollarSign className="h-5 w-5" />
                Spending
              </h2>
              <p className="text-sm text-muted-foreground">
                By category compared to budgeted amounts
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

        {/* Pace Tab - Burn rate chart */}
        <TabsContent value="pace" className="mt-6">
          <div className="rounded-lg border p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <CircleGauge className="h-5 w-5" />
                  Spending Pace
                </h2>
                <p className="text-sm text-muted-foreground">
                  Are you spending at a sustainable rate through the period?
                </p>
              </div>
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
            <div className="mt-6">
              <BurnRateChart
                dailySpending={burnRateData.dailySpending}
                totalBudget={burnRateData.totalBudget}
                periodStart={burnRateData.periodStart}
                periodEnd={burnRateData.periodEnd}
                periodLabel={burnRateData.periodLabel}
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
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Wallet className="h-5 w-5" />
                  Cash Flow
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isPastOnly
                    ? 'Past income, expenses, and savings'
                    : isFutureOnly
                      ? 'Forecasted monthly income, expenses, and savings'
                      : 'Income, expenses and savings'}
                </p>
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <PiggyBank className="h-5 w-5" />
                  {savingsView === 'total'
                    ? 'Total Savings'
                    : savingsByGoal.find((g) => g.goalId === savingsView)?.goalName ?? 'Savings'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isPastOnly
                    ? 'Cumulative savings contributions'
                    : 'Solid line is actual, dashed line is forecasted'}
                </p>
              </div>
              {savingsByGoal.length > 0 && (
                <Select value={savingsView} onValueChange={handleSavingsViewChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Total Savings</SelectItem>
                    {savingsByGoal.map((goal) => (
                      <SelectItem key={goal.goalId} value={goal.goalId}>
                        {goal.goalName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="mt-6">
              {savingsView === 'total' ? (
                <SavingsOverTimeChart monthlySavings={monthlySavings} />
              ) : (
                <SavingsOverTimeChart
                  monthlySavings={
                    savingsByGoal.find((g) => g.goalId === savingsView)?.monthlySavings ?? []
                  }
                  deadline={savingsByGoal.find((g) => g.goalId === savingsView)?.deadline}
                  targetAmount={savingsByGoal.find((g) => g.goalId === savingsView)?.targetAmount}
                  startingBalance={savingsByGoal.find((g) => g.goalId === savingsView)?.startingBalance}
                />
              )}
            </div>

            {savingsByGoal.length > 0 && (
              <div className="mt-8 border-t pt-6">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
