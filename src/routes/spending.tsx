import { useState } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CircleGauge,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Receipt,
  ChevronLeft,
  ChevronRight,
  History,
  Layers,
  Sparkles,
  Plus,
} from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useScenarios } from '@/hooks/use-scenarios';
import { useTransactions } from '@/hooks/use-transactions';
import { ScenarioSelector } from '@/components/scenario-selector';
import { TransactionDialog } from '@/components/dialogs/transaction-dialog';
import { useBudgetPeriodData } from '@/hooks/use-budget-period-data';
import { CHART_COLORS } from '@/lib/chart-colors';
import { BurnRateChart, BudgetAllocationBar } from '@/components/charts';
import { cn, formatCents } from '@/lib/utils';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

export function SpendingPage() {
  const { activeScenarioId, startDate, endDate } = useOutletContext<OutletContext>();
  const { activeScenario, scenarios, setActiveScenarioId } = useScenarios();
  const { addTransaction, updateTransaction } = useTransactions(startDate, endDate);

  // Selected period state - defaults to current month
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());

  // Category visibility state for spending breakdown
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  // Transaction dialog state
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);

  // Use the extracted hook for all business logic
  const {
    periodLabel,
    isCurrentPeriod,
    isFuturePeriod,
    isPastPeriod,
    isLoading,
    periodCashFlow,
    periodSpending,
    forecastExpenses,
    burnRateData,
    colorMap,
  } = useBudgetPeriodData({
    scenarioId: activeScenarioId,
    selectedMonth,
    viewMode,
  });

  const selectedYear = selectedMonth.getFullYear();

  // Navigation handlers
  const goToPrevious = () => {
    if (viewMode === 'year') {
      setSelectedMonth((prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1));
    } else {
      setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const goToNext = () => {
    if (viewMode === 'year') {
      setSelectedMonth((prev) => new Date(prev.getFullYear() + 1, prev.getMonth(), 1));
    } else {
      setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  const goToCurrent = () => {
    setSelectedMonth(new Date());
    setViewMode('month');
  };

  const selectYear = (year: number) => {
    setSelectedMonth(new Date(year, 0, 1));
    setViewMode('year');
    setCalendarOpen(false);
  };

  const selectedMonthIndex = selectedMonth.getMonth();

  // Show loading spinner while data is being fetched
  if (isLoading) {
    return (
      <div className="page-shell">
        <PageLoading />
      </div>
    );
  }

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="page-shell space-y-6">
        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">
            <div className="page-title-icon bg-red-500/10">
              <Receipt className="h-5 w-5 text-red-500" />
            </div>
            Spending
          </h1>
          <p className="page-description">Track your spending against your plan</p>
        </div>

        {/* Hero Header - Period Selector */}
        <div className="min-h-28 text-center sm:min-h-32">
          {/* Today link - above period when not current */}
          <div className="flex min-h-8 items-center justify-center">
            {!isCurrentPeriod && (
              <Button variant="ghost" size="sm" onClick={goToCurrent} className="text-xs">
                ← Today
              </Button>
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" onClick={goToPrevious} className="h-10 w-10">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Popover open={calendarOpen} onOpenChange={(open) => {
              setCalendarOpen(open);
              if (open) setPickerYear(selectedYear);
            }}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="w-52 text-3xl font-bold tracking-tight hover:bg-transparent hover:text-foreground/80 sm:w-56">
                  {periodLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="center">
                <div className="mb-3 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPickerYear((y) => y - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'year' && pickerYear === selectedYear ? 'default' : 'ghost'}
                    size="sm"
                    className="text-sm font-semibold"
                    onClick={() => selectYear(pickerYear)}
                  >
                    {pickerYear}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPickerYear((y) => y + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {MONTHS.map((month, index) => {
                    const isSelected = viewMode === 'month' && pickerYear === selectedYear && index === selectedMonthIndex;
                    const isCurrent = pickerYear === new Date().getFullYear() && index === new Date().getMonth();
                    return (
                      <Button
                        key={month}
                        variant={isSelected ? 'default' : 'ghost'}
                        size="sm"
                        className={cn(
                          'h-8 text-xs',
                          isCurrent && !isSelected && 'border border-primary',
                        )}
                        onClick={() => {
                          setSelectedMonth(new Date(pickerYear, index, 1));
                          setViewMode('month');
                          setCalendarOpen(false);
                        }}
                      >
                        {month.slice(0, 3)}
                      </Button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" onClick={goToNext} className="h-10 w-10">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          {/* Status line placeholder for consistent height */}
          <div className="mt-2 min-h-9" />
          <div className="mx-auto mt-4 mb-3 h-px w-24 bg-border" />
          <div className="flex items-center justify-center">
            <ScenarioSelector />
          </div>
        </div>

        <div className="empty-state">
          <p className="empty-state-text">Select a scenario to track your budget.</p>
          <Button asChild className="empty-state-action">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            <div className="page-title-icon bg-red-500/10">
              <Receipt className="h-5 w-5 text-red-500" />
            </div>
            Spending
          </h1>
          <p className="page-description">Track your spending against your plan</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="h-10" asChild>
            <Link to="/money?tab=expected">
              <Plus className="h-4 w-4" />
              Add Expected
            </Link>
          </Button>
          <Button className="h-10" onClick={() => setTransactionDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Hero Header - Period Selector */}
      <div className="mb-4 min-h-28 text-center sm:min-h-32">
        {/* Today link - above period when not current */}
        <div className="flex min-h-8 items-center justify-center">
          {!isCurrentPeriod && (
            <Button variant="ghost" size="sm" onClick={goToCurrent} className="text-xs">
              {isPastPeriod ? 'Today →' : '← Today'}
            </Button>
          )}
        </div>
        {/* Period Navigation */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPrevious} className="h-10 w-10">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Popover open={calendarOpen} onOpenChange={(open) => {
            setCalendarOpen(open);
            if (open) setPickerYear(selectedYear);
          }}>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="w-52 text-3xl font-bold tracking-tight hover:bg-transparent hover:text-foreground/80 sm:w-56">
                {periodLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="center">
              {/* Year selector - clickable to select whole year */}
              <div className="mb-3 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPickerYear((y) => y - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'year' && pickerYear === selectedYear ? 'default' : 'ghost'}
                  size="sm"
                  className="text-sm font-semibold"
                  onClick={() => selectYear(pickerYear)}
                >
                  {pickerYear}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPickerYear((y) => y + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {/* Month grid */}
              <div className="grid grid-cols-3 gap-1">
                {MONTHS.map((month, index) => {
                  const isSelected = viewMode === 'month' && pickerYear === selectedYear && index === selectedMonthIndex;
                  const isCurrent = pickerYear === new Date().getFullYear() && index === new Date().getMonth();
                  return (
                    <Button
                      key={month}
                      variant={isSelected ? 'default' : 'ghost'}
                      size="sm"
                      className={cn(
                        'h-8 text-xs',
                        isCurrent && !isSelected && 'border border-primary',
                      )}
                      onClick={() => {
                        setSelectedMonth(new Date(pickerYear, index, 1));
                        setViewMode('month');
                        setCalendarOpen(false);
                      }}
                    >
                      {month.slice(0, 3)}
                    </Button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={goToNext} className="h-10 w-10">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Status line - day counter or badge */}
        <div className="mt-2 flex min-h-9 items-center justify-center">
          {isCurrentPeriod && (
            <span className="text-sm text-muted-foreground">
              {viewMode === 'month'
                ? `Day ${periodCashFlow.dayOfPeriod} of ${periodCashFlow.daysInPeriod}`
                : `Month ${new Date().getMonth() + 1} of 12`}
            </span>
          )}
          {isPastPeriod && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              <History className="h-3 w-3" />
              Historical
            </span>
          )}
          {isFuturePeriod && (
            <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs text-blue-600 dark:text-blue-400">
              <Sparkles className="h-3 w-3" />
              Projected
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="mx-auto mt-4 mb-3 h-px w-24 bg-border" />

        {/* Controls */}
        <div className="flex items-center justify-center">
          {isFuturePeriod && scenarios.length > 1 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Scenario:</span>
              <Select
                value={activeScenarioId ?? undefined}
                onValueChange={(value) => setActiveScenarioId(value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select scenario" />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((scenario) => (
                    <SelectItem key={scenario.id} value={scenario.id}>
                      {scenario.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <ScenarioSelector />
          )}
        </div>
      </div>

      {/* Top Row: Month End + Spending Pace */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Month End Projection - most important metric */}
        {(() => {
          // Plan = what you'd have left if you spent exactly your budgets
          // This matches the "available" shown in the unbudgeted card
          const planned = periodCashFlow.unbudgeted.unallocated;

          // Check if there's actually a plan set (budgets and/or forecasts exist)
          const hasPlan = periodCashFlow.income.expected > 0 || periodCashFlow.budgeted.expected > 0;

          let leftover: number;
          let description: string;

          let secondaryDescription: string | null = null;

          if (isPastPeriod) {
            // Past: show actual result
            leftover = periodCashFlow.income.actual - periodCashFlow.expenses.actual - periodCashFlow.savings.actual;
            description = leftover > 0 ? 'Actual surplus' : leftover < 0 ? 'Actual shortfall' : 'Broke even';
          } else if (isFuturePeriod) {
            // Future: show planned outcome (only if there's a plan)
            if (!hasPlan) {
              leftover = 0;
              description = 'No forecast set';
            } else {
              leftover = planned;
              description = leftover > 0 ? 'Planned surplus' : leftover < 0 ? 'Planned shortfall' : 'Fully allocated';
            }
          } else {
            // Current: project based on current spending pace
            const periodProgress = periodCashFlow.dayOfPeriod / periodCashFlow.daysInPeriod;
            const projectedSpending = periodProgress > 0 ? Math.round(periodCashFlow.expenses.actual / periodProgress) : 0;

            // Use actual income if no forecast, otherwise use expected
            const incomeToUse = periodCashFlow.income.expected > 0
              ? periodCashFlow.income.expected
              : periodCashFlow.income.actual;
            const availableToSpend = incomeToUse - periodCashFlow.savings.expected;
            leftover = availableToSpend - projectedSpending;

            // Label for projected outcome
            if (!hasPlan) {
              description = 'No plan set';
            } else {
              description = leftover > 0 ? 'Projected surplus' : leftover < 0 ? 'Projected shortfall' : 'On track';
            }

            // Compare to plan as secondary info (only if there's a meaningful plan)
            if (hasPlan && planned !== 0) {
              const diffFromPlan = leftover - planned;
              if (diffFromPlan >= 0) {
                secondaryDescription = `${formatCents(Math.abs(diffFromPlan))} above ${formatCents(planned)} plan`;
              } else {
                secondaryDescription = `${formatCents(Math.abs(diffFromPlan))} below ${formatCents(planned)} plan`;
              }
            }
          }

          const isShortfall = leftover < 0 && hasPlan;
          const isZero = leftover === 0;
          const isNoPlan = !hasPlan;

          // Threshold for "comfortable" = 10% of planned buffer (only if plan exists)
          const comfortableThreshold = hasPlan ? planned * 0.1 : 0;
          const isTight = !isPastPeriod && !isFuturePeriod && hasPlan && leftover > 0 && leftover < comfortableThreshold;

          let iconBg: string;
          let iconColor: string;
          let textColor: string;

          if (isNoPlan) {
            iconBg = 'bg-slate-500/10';
            iconColor = 'text-slate-500';
            textColor = 'text-muted-foreground';
          } else if (isShortfall) {
            iconBg = 'bg-red-500/10';
            iconColor = 'text-red-500';
            textColor = 'text-red-600';
          } else if (isZero) {
            iconBg = 'bg-slate-500/10';
            iconColor = 'text-slate-500';
            textColor = '';
          } else if (isTight) {
            iconBg = 'bg-amber-500/10';
            iconColor = 'text-amber-500';
            textColor = 'text-amber-600';
          } else {
            iconBg = 'bg-green-500/10';
            iconColor = 'text-green-500';
            textColor = 'text-green-600';
          }

          return (
            <div className="flex min-h-[168px] flex-col rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>
                  {isShortfall ? (
                    <TrendingDown className={`h-4 w-4 ${iconColor}`} />
                  ) : (
                    <TrendingUp className={`h-4 w-4 ${iconColor}`} />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{viewMode === 'year' ? 'Year' : 'Month'} End</p>
              </div>
              <div className="flex-1" />
              <p className={`text-3xl font-bold ${textColor}`}>
                {isShortfall ? '' : '+'}{formatCents(leftover)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {description}
              </p>
              <p className={`mt-1 min-h-[1rem] text-xs ${secondaryDescription ? 'text-amber-600 dark:text-amber-400' : 'invisible'}`}>
                {secondaryDescription || '\u00A0'}
              </p>
            </div>
          );
        })()}

        {/* Spending Pace / Budget Allocation */}
        {isFuturePeriod ? (
          <div className="flex min-h-[168px] flex-col rounded-xl border bg-card p-5">
            <BudgetAllocationBar
              income={periodCashFlow.income.expected}
              spending={periodCashFlow.budgeted.expected}
              savings={periodCashFlow.savings.expected}
              surplus={periodCashFlow.unbudgeted.unallocated}
            />
          </div>
        ) : (
          <div className="flex min-h-[168px] flex-col rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-500/10">
                <CircleGauge className="h-4 w-4 text-slate-500" />
              </div>
              <p className="text-sm text-muted-foreground">Spending Pace</p>
            </div>
            <div className="mt-2">
              <BurnRateChart
                dailySpending={burnRateData.dailySpending}
                totalBudget={burnRateData.totalBudget}
                periodStart={burnRateData.periodStart}
                periodEnd={burnRateData.periodEnd}
                periodLabel={burnRateData.periodLabel}
                compact
              />
            </div>
          </div>
        )}
      </div>

      {/* Cash Flow Card - Income, Savings, Spending all relative to income */}
      <div className="rounded-xl border bg-card p-6">
        {(() => {
          // Use income as the baseline for all bars (100% = full income)
          // Prefer expected, but fall back to actual if no forecast
          const incomeAmount = periodCashFlow.income.expected || periodCashFlow.income.actual || 1;

          // Income values
          const actualIncome = periodCashFlow.income.actual;
          const expectedIncome = periodCashFlow.income.expected;
          const hasIncomeForecast = expectedIncome > 0;
          const incomePct = hasIncomeForecast ? Math.round((actualIncome / expectedIncome) * 100) : 100;

          // Spending values
          const totalSpent = isFuturePeriod ? periodCashFlow.budgeted.expected : periodCashFlow.expenses.actual;
          const totalBudget = periodCashFlow.budgeted.expected;
          const unplanned = periodCashFlow.unbudgeted.actual;
          const spentPctOfBudget = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
          const spentPctOfIncome = (totalSpent / incomeAmount) * 100;
          const budgetPctOfIncome = (totalBudget / incomeAmount) * 100;
          const isOverBudget = totalSpent > totalBudget && totalBudget > 0;

          // Savings values
          const actualSavings = periodCashFlow.savings.actual;
          const expectedSavings = periodCashFlow.savings.expected;
          const savingsPct = expectedSavings > 0 ? Math.round((actualSavings / expectedSavings) * 100) : 0;
          const savingsPctOfIncome = (actualSavings / incomeAmount) * 100;
          const expectedSavingsPctOfIncome = (expectedSavings / incomeAmount) * 100;

          return (
            <>
              {/* Card Header */}
              <h3 className="text-lg font-semibold">{isFuturePeriod ? 'Expected Cash Flow' : 'Cash Flow'}</h3>
              <p className="text-sm text-muted-foreground">All bars relative to {formatCents(incomeAmount)} income</p>

              {/* Income Section */}
              <div className="mt-6 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                      <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                    </div>
                    <span className="font-medium">{isFuturePeriod ? 'Projected Income' : 'Earned'}</span>
                  </div>
                  <span className="font-mono text-right text-muted-foreground">
                    {isFuturePeriod ? (
                      formatCents(expectedIncome)
                    ) : hasIncomeForecast ? (
                      <>{incomePct}% of {formatCents(expectedIncome)} expected</>
                    ) : (
                      <>{formatCents(actualIncome)} earned</>
                    )}
                  </span>
                </div>
                <div className="relative h-3 rounded-full bg-muted">
                  {/* Light bar: expected income (100% of itself) */}
                  <div className="absolute h-3 w-full rounded-full bg-green-500/25" />
                  {/* Dark bar: actual income received */}
                  {!isFuturePeriod && (
                    <div
                      className="absolute h-3 rounded-full bg-green-500"
                      style={{ width: `${Math.min(incomePct, 100)}%` }}
                    />
                  )}
                  {isFuturePeriod && (
                    <div className="absolute h-3 w-full rounded-full bg-green-500" />
                  )}
                </div>
              </div>

              {/* Savings Section */}
              <div className="mt-5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                      <PiggyBank className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <span className="font-medium">{isFuturePeriod ? 'Planned Savings' : 'Saved'}</span>
                  </div>
                  <span className="font-mono text-right text-muted-foreground">
                    {isFuturePeriod ? (
                      <>{formatCents(expectedSavings)} ({Math.round(expectedSavingsPctOfIncome)}%)</>
                    ) : (
                      <>{savingsPct}% of {formatCents(expectedSavings)} planned</>
                    )}
                  </span>
                </div>
                <div className="relative h-3 rounded-full bg-muted">
                  {/* Light bar: planned savings as % of income */}
                  {expectedSavings > 0 && (
                    <div
                      className="absolute h-3 rounded-full bg-blue-500/25"
                      style={{ width: `${Math.min(expectedSavingsPctOfIncome, 100)}%` }}
                    />
                  )}
                  {/* Dark bar: actual savings as % of income */}
                  <div
                    className="absolute h-3 rounded-full bg-blue-500"
                    style={{ width: `${Math.min(isFuturePeriod ? expectedSavingsPctOfIncome : savingsPctOfIncome, 100)}%` }}
                  />
                </div>
              </div>

              {/* Spending Section */}
              <div className="mt-5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                      <Receipt className="h-3.5 w-3.5 text-red-500" />
                    </div>
                    <span className="font-medium">{isFuturePeriod ? 'Planned Spending' : 'Spent'}</span>
                  </div>
                  <span className={cn('font-mono text-right', isOverBudget ? 'text-red-500' : 'text-muted-foreground')}>
                    {isFuturePeriod ? (
                      <>{formatCents(totalBudget)} ({Math.round(budgetPctOfIncome)}%)</>
                    ) : (
                      <>
                        {spentPctOfBudget}% of {formatCents(totalBudget)} budget
                        {unplanned > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {' '}· {formatCents(unplanned)} unplanned
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </div>
                <div className="relative h-3 rounded-full bg-muted">
                  {/* Light bar: budget as % of income */}
                  {totalBudget > 0 && (
                    <div
                      className="absolute h-3 rounded-full bg-red-500/25"
                      style={{ width: `${Math.min(budgetPctOfIncome, 100)}%` }}
                    />
                  )}
                  {/* Dark bar: actual spending as % of income */}
                  <div
                    className={`absolute h-3 rounded-full bg-red-500 ${isOverBudget ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                    style={{ width: `${Math.min(spentPctOfIncome, 100)}%` }}
                  />
                </div>
              </div>

            </>
          );
        })()}
      </div>

      {/* Spending by Category Card */}
      <div className="rounded-xl border bg-card p-6">
        {(() => {
          // Use income as the baseline for all bars (100% = full income)
          const incomeAmount = periodCashFlow.income.expected || periodCashFlow.income.actual || 1;

          // Get categories based on period type
          const categories = isFuturePeriod
            ? forecastExpenses.map((c) => ({
                id: c.id,
                name: c.id === 'uncategorized' ? 'Unplanned' : c.name,
                amount: c.amount,
                budget: 0,
                color: colorMap[c.id] ?? CHART_COLORS.uncategorized,
              }))
            : periodSpending.categorySpending.map((c) => ({
                id: c.id,
                name: c.id === 'uncategorized' ? 'Unplanned' : c.name,
                amount: c.amount,
                budget: c.budget,
                color: colorMap[c.id] ?? CHART_COLORS.uncategorized,
              }));

          const visibleCategories = categories.filter((c) => !hiddenCategories.has(c.id));
          const allHidden = categories.length > 0 && visibleCategories.length === 0;

          const toggleCategory = (id: string) => {
            setHiddenCategories((prev) => {
              const next = new Set(prev);
              if (next.has(id)) {
                next.delete(id);
              } else {
                next.add(id);
              }
              return next;
            });
          };

          return (
            <>
              {/* Card Header */}
              <h3 className="text-lg font-semibold">{isFuturePeriod ? 'Expected Spending by Category' : 'Spending by Category'}</h3>
              <p className="text-sm text-muted-foreground">
                {categories.length} {categories.length === 1 ? 'category' : 'categories'}
              </p>

              {/* Category breakdown */}
              {categories.length === 0 ? (
                <div className="mt-4 flex h-24 items-center justify-center text-sm text-muted-foreground">
                  {isFuturePeriod
                    ? `No expenses expected for ${periodLabel}.`
                    : `No expenses recorded ${isCurrentPeriod ? (viewMode === 'year' ? 'this year' : 'this month') : `in ${periodLabel}`}.`}
                </div>
              ) : allHidden ? (
                <div className="mt-4 flex h-24 items-center justify-center text-sm text-muted-foreground">
                  All categories hidden. Click a category below to show it.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {visibleCategories.map((item) => {
                    const hasBudget = item.budget > 0;
                    const isOverBudget = hasBudget && item.amount > item.budget;

                    // Bars as percentage of income
                    const itemSpentPctOfIncome = (item.amount / incomeAmount) * 100;
                    const budgetPctOfIncome = hasBudget ? (item.budget / incomeAmount) * 100 : 0;
                    // Text shows spent/budget percentage
                    const itemPctOfBudget = hasBudget ? Math.round((item.amount / item.budget) * 100) : null;

                    return (
                      <div key={item.id} className="space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
                          <span className="font-medium">{item.name}</span>
                          <span className={cn('font-mono text-right', isOverBudget ? 'text-red-500' : 'text-muted-foreground')}>
                            {hasBudget ? (
                              <>{itemPctOfBudget}% of {formatCents(item.budget)} budget</>
                            ) : isFuturePeriod ? (
                              <>{formatCents(item.amount)} ({Math.round(itemSpentPctOfIncome)}%)</>
                            ) : (
                              <>{formatCents(item.amount)}</>
                            )}
                          </span>
                        </div>
                        <div className="relative h-3 rounded-full bg-muted">
                          {/* Light bar: budget as % of income */}
                          {hasBudget && (
                            <div
                              className="absolute h-3 rounded-full"
                              style={{
                                width: `${Math.min(budgetPctOfIncome, 100)}%`,
                                backgroundColor: item.color,
                                opacity: 0.25,
                              }}
                            />
                          )}
                          {/* Dark bar: actual spending as % of income */}
                          <div
                            className={`absolute h-3 rounded-full ${isOverBudget ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                            style={{
                              width: `${Math.min(itemSpentPctOfIncome, 100)}%`,
                              backgroundColor: isOverBudget ? '#ef4444' : item.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Controls and legend */}
              {categories.length > 0 && (
                <>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setHiddenCategories(new Set())}
                      className="cursor-pointer rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      Show All
                    </button>
                    <button
                      onClick={() => setHiddenCategories(new Set(categories.map((c) => c.id)))}
                      className="cursor-pointer rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      Hide All
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {categories.map((cat) => {
                      const isHidden = hiddenCategories.has(cat.id);
                      const hasBudget = cat.budget > 0;
                      const isOverBudget = hasBudget && cat.amount > cat.budget;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => toggleCategory(cat.id)}
                          className={cn(
                            'flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-all hover:bg-muted',
                            isHidden && 'opacity-40',
                          )}
                        >
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className={isHidden ? 'line-through' : ''}>{cat.name}</span>
                          <span className={cn('font-mono text-xs', isOverBudget ? 'text-red-500' : 'text-muted-foreground')}>
                            {formatCents(cat.amount)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          );
        })()}
      </div>

      {/* Scenario Comparison */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Compare Scenarios</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {scenarios.length > 1
            ? `See how different scenarios affect your ${viewMode === 'year' ? 'year' : 'month'}`
            : 'Create "what-if" scenarios to compare different budget plans'}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios.length > 1 ? (
            scenarios.map((scenario) => {
              const isActive = scenario.id === activeScenarioId;
              return (
                <button
                  key={scenario.id}
                  onClick={() => setActiveScenarioId(scenario.id)}
                  className={cn(
                    'cursor-pointer rounded-lg border p-4 text-left transition-colors',
                    isActive
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'text-sm font-medium',
                      isActive && 'text-primary',
                    )}>
                      {scenario.name}
                    </span>
                    {isActive && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Selected
                      </span>
                    )}
                  </div>
                  {scenario.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {scenario.description}
                    </p>
                  )}
                </button>
              );
            })
          ) : (
            <>
              {/* Current scenario - shown as selected */}
              <div className="rounded-lg border border-primary bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">
                    {activeScenario?.name ?? 'Current Plan'}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Selected
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Your current budget</p>
              </div>
              {/* Example scenarios - faded to show what's possible */}
              <Link
                to="/scenarios"
                className="group rounded-lg border border-dashed p-4 text-left opacity-60 transition-opacity hover:opacity-100"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">
                    Save More
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">What if I increased savings?</p>
              </Link>
              <Link
                to="/scenarios"
                className="group rounded-lg border border-dashed p-4 text-left opacity-60 transition-opacity hover:opacity-100"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">
                    New Job
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">What if my income changed?</p>
              </Link>
            </>
          )}
        </div>
      </div>

      <TransactionDialog
        open={transactionDialogOpen}
        onOpenChange={setTransactionDialogOpen}
        initialType="expense"
        addTransaction={addTransaction}
        updateTransaction={updateTransaction}
      />
    </div>
  );
}
