import { useState } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  CircleGauge,
  PiggyBank,
  Target,
  TrendingUp,
  TrendingDown,
  Receipt,
  CircleAlert,
  Tags,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useScenarios } from '@/hooks/use-scenarios';
import { ScenarioSelector } from '@/components/scenario-selector';
import { useBudgetPeriodData } from '@/hooks/use-budget-period-data';
import { CHART_COLORS } from '@/lib/chart-colors';
import { BurnRateChart } from '@/components/charts';
import { cn, formatCents } from '@/lib/utils';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface OutletContext {
  activeScenarioId: string | null;
}

export function BudgetPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();

  // Selected period state - defaults to current month
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());

  // Use the extracted hook for all business logic
  const {
    periodLabel,
    isCurrentPeriod,
    isFuturePeriod,
    isPastPeriod,
    isLoading,
    periodCashFlow,
    periodSpending,
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
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <Target className="h-5 w-5 text-slate-500" />
            </div>
            Budget
          </h1>
          <p className="page-description">Track your spending against your plan</p>
        </div>

        {/* Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={goToPrevious} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover open={calendarOpen} onOpenChange={(open) => {
              setCalendarOpen(open);
              if (open) setPickerYear(selectedYear);
            }}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="text-lg font-semibold">
                  {periodLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start">
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
            <Button variant="ghost" size="icon" onClick={goToNext} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentPeriod && (
              <Button variant="ghost" size="sm" onClick={goToCurrent} className="ml-2 text-xs">
                Today
              </Button>
            )}
          </div>
          <ScenarioSelector />
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
      <div className="page-header">
        <h1 className="page-title">
          <div className="page-title-icon bg-slate-500/10">
            <Target className="h-5 w-5 text-slate-500" />
          </div>
          Budget
        </h1>
        <p className="page-description">Track your spending against your plan</p>
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={goToPrevious} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover open={calendarOpen} onOpenChange={(open) => {
            setCalendarOpen(open);
            if (open) setPickerYear(selectedYear);
          }}>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="text-lg font-semibold">
                {periodLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
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
          <Button variant="ghost" size="icon" onClick={goToNext} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentPeriod && (
            <Button variant="ghost" size="sm" onClick={goToCurrent} className="ml-2 text-xs">
              Today
            </Button>
          )}
          {isCurrentPeriod && viewMode === 'month' && (
            <span className="ml-2 text-sm text-muted-foreground">
              Day {periodCashFlow.dayOfPeriod} of {periodCashFlow.daysInPeriod}
            </span>
          )}
        </div>
        <ScenarioSelector />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Earned */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Earned</p>
          <p className="mt-1 text-xl font-semibold">{formatCents(periodCashFlow.income.actual)}</p>
          <div className="mt-3 mb-3 h-px bg-border" />
          {(() => {
            const pct = periodCashFlow.income.expected > 0
              ? Math.round((periodCashFlow.income.actual / periodCashFlow.income.expected) * 100)
              : 0;
            const markerPos = isPastPeriod ? 100 : isFuturePeriod ? 0 : (periodCashFlow.dayOfPeriod / periodCashFlow.daysInPeriod) * 100;
            return (
              <>
                <div className="relative h-1.5 rounded-full bg-green-500/20">
                  <div
                    className="h-1.5 rounded-full bg-green-500"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                  <div
                    className="absolute top-0 h-1.5 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
                    style={{ left: `${Math.min(markerPos, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Earned {pct}% of {formatCents(periodCashFlow.income.expected)} forecast
                </p>
              </>
            );
          })()}
        </div>

        {/* Budgeted Spending */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
            <Receipt className="h-5 w-5 text-red-500" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Budgeted Spending</p>
          <p className="mt-1 text-xl font-semibold">{formatCents(periodCashFlow.budgeted.actual)}</p>
          <div className="mt-3 mb-3 h-px bg-border" />
          {(() => {
            const pct = periodCashFlow.budgeted.expected > 0
              ? Math.round((periodCashFlow.budgeted.actual / periodCashFlow.budgeted.expected) * 100)
              : 0;
            const markerPos = isPastPeriod ? 100 : isFuturePeriod ? 0 : (periodCashFlow.dayOfPeriod / periodCashFlow.daysInPeriod) * 100;
            return (
              <>
                <div className="relative h-1.5 rounded-full bg-red-500/20">
                  <div
                    className="h-1.5 rounded-full bg-red-500"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                  <div
                    className="absolute top-0 h-1.5 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
                    style={{ left: `${Math.min(markerPos, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Spent {pct}% of {formatCents(periodCashFlow.budgeted.expected)} budget
                </p>
              </>
            );
          })()}
        </div>

        {/* Unplanned Spending */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
            <CircleAlert className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Unplanned Spending</p>
          <p className="mt-1 text-xl font-semibold">{formatCents(periodCashFlow.unbudgeted.actual)}</p>
          <div className="mt-3 mb-3 h-px bg-border" />
          {(() => {
            const pct = periodCashFlow.unbudgeted.unallocated > 0
              ? Math.round((periodCashFlow.unbudgeted.actual / periodCashFlow.unbudgeted.unallocated) * 100)
              : 0;
            const markerPos = isPastPeriod ? 100 : isFuturePeriod ? 0 : (periodCashFlow.dayOfPeriod / periodCashFlow.daysInPeriod) * 100;
            return (
              <>
                <div className="relative h-1.5 rounded-full bg-amber-500/20">
                  <div
                    className="h-1.5 rounded-full bg-amber-500"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                  <div
                    className="absolute top-0 h-1.5 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
                    style={{ left: `${Math.min(markerPos, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Spent {pct}% of {formatCents(periodCashFlow.unbudgeted.unallocated)} surplus
                </p>
              </>
            );
          })()}
        </div>

        {/* Saved */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
            <PiggyBank className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Saved</p>
          <p className="mt-1 text-xl font-semibold">{formatCents(periodCashFlow.savings.actual)}</p>
          <div className="mt-3 mb-3 h-px bg-border" />
          {(() => {
            const pct = periodCashFlow.savings.expected > 0
              ? Math.round((periodCashFlow.savings.actual / periodCashFlow.savings.expected) * 100)
              : 0;
            const markerPos = isPastPeriod ? 100 : isFuturePeriod ? 0 : (periodCashFlow.dayOfPeriod / periodCashFlow.daysInPeriod) * 100;
            return (
              <>
                <div className="relative h-1.5 rounded-full bg-blue-500/20">
                  <div
                    className="h-1.5 rounded-full bg-blue-500"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                  <div
                    className="absolute top-0 h-1.5 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
                    style={{ left: `${Math.min(markerPos, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Saved {pct}% of {formatCents(periodCashFlow.savings.expected)} planned
                </p>
              </>
            );
          })()}
        </div>
      </div>

      {/* Pace & Projection Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Mini Pace Chart */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-500/10">
              <CircleGauge className="h-4 w-4 text-slate-500" />
            </div>
            <p className="text-sm text-muted-foreground">Spending pace</p>
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

        {/* Month End Projection */}
        {(() => {
          // Plan = what you'd have left if you spent exactly your budgets
          // This matches the "available" shown in the unbudgeted card
          const planned = periodCashFlow.unbudgeted.unallocated;

          let leftover: number;
          let description: string;

          if (isPastPeriod) {
            // Past: show actual result
            leftover = periodCashFlow.income.actual - periodCashFlow.expenses.actual - periodCashFlow.savings.actual;
            description = leftover >= 0 ? 'Actual surplus' : 'Actual shortfall';
          } else if (isFuturePeriod) {
            // Future: show planned outcome
            leftover = planned;
            description = leftover >= 0 ? 'Planned surplus' : 'Planned shortfall';
          } else {
            // Current: project based on current spending pace
            const periodProgress = periodCashFlow.dayOfPeriod / periodCashFlow.daysInPeriod;
            const projectedSpending = periodProgress > 0 ? Math.round(periodCashFlow.expenses.actual / periodProgress) : 0;
            const availableToSpend = periodCashFlow.income.expected - periodCashFlow.savings.expected;
            leftover = availableToSpend - projectedSpending;

            // Compare to plan
            const diffFromPlan = leftover - planned;
            if (diffFromPlan >= 0) {
              description = `${formatCents(Math.abs(diffFromPlan))} above ${formatCents(planned)} plan`;
            } else {
              description = `${formatCents(Math.abs(diffFromPlan))} below ${formatCents(planned)} plan`;
            }
          }

          const isShortfall = leftover < 0;

          // Threshold for "comfortable" = 10% of planned buffer
          const comfortableThreshold = planned * 0.1;
          const isTight = !isPastPeriod && !isFuturePeriod && leftover >= 0 && leftover < comfortableThreshold;

          let iconBg: string;
          let iconColor: string;
          let textColor: string;

          if (isShortfall) {
            iconBg = 'bg-red-500/10';
            iconColor = 'text-red-500';
            textColor = 'text-red-600';
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
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>
                  {isShortfall ? (
                    <TrendingDown className={`h-4 w-4 ${iconColor}`} />
                  ) : (
                    <TrendingUp className={`h-4 w-4 ${iconColor}`} />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{viewMode === 'year' ? 'Year' : 'Month'} end</p>
              </div>
              <p className={`mt-2 text-3xl font-bold ${textColor}`}>
                {isShortfall ? '' : '+'}{formatCents(leftover)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {description}
              </p>
            </div>
          );
        })()}
      </div>

      {/* Spending by Category */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">{periodLabel} Spending</h3>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{formatCents(periodSpending.total)}</p>
            <p className="text-sm text-muted-foreground">
              {periodSpending.categorySpending.length} {periodSpending.categorySpending.length === 1 ? 'category' : 'categories'}
            </p>
          </div>
        </div>

        {periodSpending.categorySpending.length === 0 ? (
          <div className="mt-6 flex h-24 items-center justify-center text-sm text-muted-foreground">
            No expenses recorded {isCurrentPeriod ? (viewMode === 'year' ? 'this year' : 'this month') : `in ${periodLabel}`}.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {periodSpending.categorySpending.map((item) => {
              const color = colorMap[item.id] ?? CHART_COLORS.uncategorized;
              const hasBudget = item.budget > 0;
              // Percentage of budget spent (capped at 100% for display)
              const spentPercent = hasBudget ? Math.min((item.amount / item.budget) * 100, 100) : 100;
              const isOverBudget = hasBudget && item.amount > item.budget;

              return (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="font-mono text-muted-foreground">
                      {formatCents(item.amount)}
                      {hasBudget && (
                        <span className="text-sm"> / {formatCents(item.budget)}</span>
                      )}
                    </span>
                  </div>
                  <div className="relative h-3 rounded-full bg-muted">
                    {/* Light bar: budget amount (full width if budgeted) */}
                    {hasBudget && (
                      <div
                        className="absolute h-3 rounded-full"
                        style={{
                          width: '100%',
                          backgroundColor: color,
                          opacity: 0.25,
                        }}
                      />
                    )}
                    {/* Dark bar: actual spending relative to budget */}
                    <div
                      className={`absolute h-3 rounded-full ${isOverBudget ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                      style={{
                        width: `${spentPercent}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
