import { useState, useMemo } from 'react';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CalendarFold,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  BanknoteArrowUp,
  BanknoteArrowDown,
  Receipt,
  ChevronLeft,
  ChevronRight,
  History,
  Sparkles,
  Plus,
  CheckCircle2,
  Pin,
  Target,
  CircleDot,
} from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useScenarios } from '@/hooks/use-scenarios';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useMultiPeriodSummary } from '@/hooks/use-multi-period-summary';
import { ScenarioSelector } from '@/components/scenario-selector';
import { TransactionDialog } from '@/components/dialogs/transaction-dialog';
import { useBudgetPeriodData } from '@/hooks/use-budget-period-data';
import { YearGrid } from '@/components/year-grid';
import { TrendSparkline } from '@/components/charts/trend-sparkline';
import { BurnRateChart } from '@/components/charts/burn-rate-chart';
import { CHART_COLORS } from '@/lib/chart-colors';
import { cn, formatCents, toMonthlyCents, type CadenceType } from '@/lib/utils';
import type { ForecastRule } from '@/lib/types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

export function SnapshotPage() {
  const { activeScenarioId, startDate, endDate } = useOutletContext<OutletContext>();
  const { activeScenario, scenarios, setActiveScenarioId } = useScenarios();
  const { addTransaction, updateTransaction } = useTransactions(startDate, endDate);
  const { budgetRules } = useBudgetRules(activeScenarioId);

  // Selected period state - defaults to current month
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'month' | 'quarter' | 'year'>('month');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());

  // Transaction dialog state
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);

  // Multi-period data for year grid (full calendar year)
  const selectedYear = selectedMonth.getFullYear();
  const { months: yearMonths } = useMultiPeriodSummary({
    scenarioId: activeScenarioId,
    year: selectedYear,
  });

  // Multi-period data for sparkline (12 months around selected month)
  const { months: sparklineMonths } = useMultiPeriodSummary({
    scenarioId: activeScenarioId,
    year: selectedYear,
    centerMonth: { monthIndex: selectedMonth.getMonth(), year: selectedMonth.getFullYear() },
  });

  // Get forecast date range for the selected period
  const forecastDateRange = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    if (viewMode === 'year') {
      return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      };
    }
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }, [selectedMonth, viewMode]);

  const { rules: forecastRules } = useForecasts(
    activeScenarioId,
    forecastDateRange.startDate,
    forecastDateRange.endDate,
  );

  // Get expense rules for fixed category detection
  const expenseRules = useMemo(() => forecastRules.filter(r => r.type === 'expense'), [forecastRules]);

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

  // Navigation handlers
  const goToPrevious = () => {
    if (viewMode === 'year') {
      setSelectedMonth((prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1));
    } else if (viewMode === 'quarter') {
      setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 3, 1));
    } else {
      setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const goToNext = () => {
    if (viewMode === 'year') {
      setSelectedMonth((prev) => new Date(prev.getFullYear() + 1, prev.getMonth(), 1));
    } else if (viewMode === 'quarter') {
      setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 3, 1));
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

  const selectQuarter = (year: number, quarter: number) => {
    // Quarter 1 = months 0-2, Quarter 2 = months 3-5, etc.
    setSelectedMonth(new Date(year, (quarter - 1) * 3, 1));
    setViewMode('quarter');
    setCalendarOpen(false);
  };

  const selectedMonthIndex = selectedMonth.getMonth();
  const selectedQuarter = Math.floor(selectedMonthIndex / 3) + 1;

  // Get months for current quarter view
  const quarterMonths = useMemo(() => {
    const quarterStart = (selectedQuarter - 1) * 3;
    return yearMonths.filter((m) => m.monthIndex >= quarterStart && m.monthIndex < quarterStart + 3);
  }, [yearMonths, selectedQuarter]);

  // Compute display label (override for quarter mode)
  const displayPeriodLabel = viewMode === 'quarter'
    ? `Q${selectedQuarter} ${selectedYear}`
    : periodLabel;

  // Calculate fixed expenses per category for this period
  const fixedExpensesPerCategory = useMemo(() => {
    const result: Record<string, { amount: number; rules: ForecastRule[] }> = {};
    const periodMultiplier = viewMode === 'year' ? 12 : 1;

    for (const rule of expenseRules) {
      if (rule.categoryId) {
        if (!result[rule.categoryId]) {
          result[rule.categoryId] = { amount: 0, rules: [] };
        }
        // Convert to monthly then to period
        const monthlyAmount = toMonthlyCents(rule.amountCents, rule.cadence as CadenceType);
        const catData = result[rule.categoryId];
        if (catData) {
          catData.amount += monthlyAmount * periodMultiplier;
          catData.rules.push(rule);
        }
      }
    }

    return result;
  }, [expenseRules, viewMode]);

  // Calculate variable budgets per category for this period
  const variableBudgetsPerCategory = useMemo(() => {
    const result: Record<string, number> = {};
    const periodMultiplier = viewMode === 'year' ? 12 : 1;

    for (const rule of budgetRules) {
      const monthlyAmount = toMonthlyCents(rule.amountCents, rule.cadence as CadenceType);
      result[rule.categoryId] = monthlyAmount * periodMultiplier;
    }

    return result;
  }, [budgetRules, viewMode]);

  // Build category progress data
  const categoryProgress = useMemo(() => {
    if (isFuturePeriod) {
      // For future periods, show expected expenses by category
      return forecastExpenses.map((cat) => {
        const fixedData = fixedExpensesPerCategory[cat.id];
        const variableBudget = variableBudgetsPerCategory[cat.id] ?? 0;
        const isFixedOnly = fixedData && fixedData.amount > 0 && variableBudget === 0;
        const totalBudget = (fixedData?.amount ?? 0) + variableBudget;

        return {
          id: cat.id,
          name: cat.id === 'uncategorized' ? 'Unplanned' : cat.name,
          spent: cat.amount,
          budget: totalBudget,
          isFixedOnly,
          fixedAmount: fixedData?.amount ?? 0,
          color: colorMap[cat.id] ?? CHART_COLORS.uncategorized,
        };
      });
    }

    // For current/past periods, show actual spending progress
    return periodSpending.categorySpending.map((cat) => {
      const fixedData = fixedExpensesPerCategory[cat.id];
      const variableBudget = variableBudgetsPerCategory[cat.id] ?? 0;
      const isFixedOnly = fixedData && fixedData.amount > 0 && variableBudget === 0;
      const totalBudget = (fixedData?.amount ?? 0) + variableBudget;

      return {
        id: cat.id,
        name: cat.id === 'uncategorized' ? 'Unplanned' : cat.name,
        spent: cat.amount,
        budget: totalBudget,
        isFixedOnly,
        fixedAmount: fixedData?.amount ?? 0,
        color: colorMap[cat.id] ?? CHART_COLORS.uncategorized,
      };
    });
  }, [isFuturePeriod, forecastExpenses, periodSpending, fixedExpensesPerCategory, variableBudgetsPerCategory, colorMap]);

  // Calculate headline metric
  const headline = useMemo(() => {
    const hasPlan = periodCashFlow.income.expected > 0 || periodCashFlow.budgeted.expected > 0 || periodCashFlow.expenses.expected > 0;
    // Match Budget page: income - fixed expenses - variable budget - savings
    const planned = periodCashFlow.income.expected
      - periodCashFlow.expenses.expected   // fixed expenses (ForecastRules)
      - periodCashFlow.budgeted.expected   // variable budget (BudgetRules)
      - periodCashFlow.savings.expected;

    if (isPastPeriod) {
      const leftover = periodCashFlow.income.actual - periodCashFlow.expenses.actual - periodCashFlow.savings.actual;
      return {
        amount: leftover,
        label: leftover > 0 ? 'Actual surplus' : leftover < 0 ? 'Actual shortfall' : 'Broke even',
        isPositive: leftover >= 0,
        hasPlan,
      };
    }

    if (isFuturePeriod) {
      if (!hasPlan) {
        return { amount: 0, label: 'No forecast set', isPositive: true, hasPlan: false };
      }
      return {
        amount: planned,
        label: planned > 0 ? 'Expected surplus' : planned < 0 ? 'Expected shortfall' : 'Budget balanced',
        isPositive: planned >= 0,
        hasPlan,
      };
    }

    // Current period - use same calculation as Budget page for consistency
    // planned = income - fixed expenses - variable budget - savings
    if (!hasPlan) {
      const actualSoFar = periodCashFlow.income.actual - periodCashFlow.expenses.actual - periodCashFlow.savings.actual;
      return { amount: actualSoFar, label: 'No plan set', isPositive: actualSoFar >= 0, hasPlan: false };
    }

    return {
      amount: planned,
      label: planned > 0 ? 'Expected surplus' : planned < 0 ? 'Expected shortfall' : 'Budget balanced',
      isPositive: planned >= 0,
      hasPlan,
    };
  }, [isPastPeriod, isFuturePeriod, periodCashFlow]);

  // Calculate budget status (spending pace vs budget)
  const budgetStatus = useMemo(() => {
    const totalBudget = periodCashFlow.expenses.expected + periodCashFlow.budgeted.expected;
    const actualSpending = periodCashFlow.expenses.actual;
    const hasBudget = totalBudget > 0;

    if (isFuturePeriod) {
      return null; // No spending yet, doesn't make sense to show
    }

    if (!hasBudget) {
      return { amount: actualSpending, label: 'Spent (no budget set)', isPositive: true, hasBudget: false };
    }

    // For past periods, compare actual to full budget
    if (isPastPeriod) {
      const diff = totalBudget - actualSpending;
      if (diff > 0) {
        return { amount: diff, label: 'Spending under budget', isPositive: true, hasBudget: true };
      } else if (diff < 0) {
        return { amount: Math.abs(diff), label: 'Spending over budget', isPositive: false, hasBudget: true };
      } else {
        return { amount: 0, label: 'Spending on budget', isPositive: true, hasBudget: true };
      }
    }

    // For current period, compare pace: expected spending by now vs actual
    const periodProgress = periodCashFlow.dayOfPeriod / periodCashFlow.daysInPeriod;
    const expectedByNow = Math.round(totalBudget * periodProgress);
    const paceDiff = expectedByNow - actualSpending;

    if (paceDiff > 0) {
      return { amount: paceDiff, label: 'Spending under pace', isPositive: true, hasBudget: true };
    } else if (paceDiff < 0) {
      return { amount: Math.abs(paceDiff), label: 'Spending over pace', isPositive: false, hasBudget: true };
    } else {
      return { amount: 0, label: 'Spending on pace', isPositive: true, hasBudget: true };
    }
  }, [isFuturePeriod, isPastPeriod, periodCashFlow]);

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
            <div className="page-title-icon bg-primary/10">
              <CalendarFold className="h-5 w-5 text-primary" />
            </div>
            Snapshot
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
            <div className="page-title-icon bg-primary/10">
              <CalendarFold className="h-5 w-5 text-primary" />
            </div>
            Snapshot
          </h1>
          <p className="page-description">Track your spending against your plan</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
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
                {displayPeriodLabel}
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
              {/* Quarter selector */}
              <div className="mb-3 grid grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((q) => {
                  const isSelected = viewMode === 'quarter' && pickerYear === selectedYear && q === selectedQuarter;
                  return (
                    <Button
                      key={q}
                      variant={isSelected ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => selectQuarter(pickerYear, q)}
                    >
                      Q{q}
                    </Button>
                  );
                })}
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
        <div className="mt-2 flex min-h-9 items-center justify-center gap-2">
          {isCurrentPeriod && viewMode === 'month' && (
            <>
              <span className="flex items-center gap-1 rounded-full bg-gray-500/15 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                <CircleDot className="h-3 w-3" />
                Today
              </span>
              <span className="text-sm text-muted-foreground">
                Day {periodCashFlow.dayOfPeriod} of {periodCashFlow.daysInPeriod}
              </span>
            </>
          )}
          {isCurrentPeriod && viewMode === 'quarter' && (
            <>
              <span className="flex items-center gap-1 rounded-full bg-gray-500/15 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                <CircleDot className="h-3 w-3" />
                Today
              </span>
              <span className="text-sm text-muted-foreground">
                Month {((selectedMonthIndex % 3) + 1)} of 3
              </span>
            </>
          )}
          {isCurrentPeriod && viewMode === 'year' && (
            <>
              <span className="flex items-center gap-1 rounded-full bg-gray-500/15 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                <CircleDot className="h-3 w-3" />
                Today
              </span>
              <span className="text-sm text-muted-foreground">
                Month {new Date().getMonth() + 1} of 12
              </span>
            </>
          )}
          {isPastPeriod && viewMode !== 'year' && viewMode !== 'quarter' && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-600 dark:text-amber-400">
              <History className="h-3 w-3" />
              Historical
            </span>
          )}
          {isFuturePeriod && viewMode !== 'year' && viewMode !== 'quarter' && (
            <span className="flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 text-xs text-violet-600 dark:text-violet-400">
              <Sparkles className="h-3 w-3" />
              Projected
            </span>
          )}
        </div>

        {/* Trend Sparkline (month view only) */}
        {viewMode === 'month' && sparklineMonths.length > 0 && (
          <div className="mx-auto mt-4 max-w-xs sm:max-w-md">
            <TrendSparkline
              data={sparklineMonths}
              showNowLine
              selectedMonth={{ monthIndex: selectedMonth.getMonth(), year: selectedMonth.getFullYear() }}
              onMonthClick={(monthIndex, year) => {
                setSelectedMonth(new Date(year, monthIndex, 1));
                setViewMode('month');
              }}
            />
          </div>
        )}

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

      {/* View-specific content */}
      {viewMode === 'year' ? (
        /* Year Grid View */
        <YearGrid
          year={selectedYear}
          months={yearMonths}
          onMonthClick={(monthIndex) => {
            setSelectedMonth(new Date(selectedYear, monthIndex, 1));
            setViewMode('month');
          }}
        />
      ) : viewMode === 'quarter' ? (
        /* Quarter View - 3 months side by side */
        <div className="space-y-6">
          {/* Quarter Summary */}
          <div className="rounded-xl border bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground">Quarter total</p>
            <p
              className={cn(
                'text-xl font-bold',
                quarterMonths.reduce((sum, m) => sum + m.surplus, 0) >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {quarterMonths.reduce((sum, m) => sum + m.surplus, 0) >= 0 ? '+' : ''}
              {formatCents(quarterMonths.reduce((sum, m) => sum + m.surplus, 0))}
            </p>
          </div>

          {/* 3 Month Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {quarterMonths.map((month) => (
              <button
                key={month.month}
                type="button"
                onClick={() => {
                  setSelectedMonth(new Date(month.year, month.monthIndex, 1));
                  setViewMode('month');
                }}
                className={cn(
                  'cursor-pointer rounded-xl border bg-card p-5 text-left transition-colors hover:bg-muted/50',
                  month.isCurrentMonth && 'border-primary ring-1 ring-primary/20',
                  month.isFuture && 'opacity-70',
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{month.label}</h3>
                  {month.isCurrentMonth && (
                    <span className="flex items-center gap-1 rounded-full bg-gray-500/15 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                      <CircleDot className="h-3 w-3" />
                      Today
                    </span>
                  )}
                  {month.isFuture && !month.isCurrentMonth && (
                    <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs text-violet-600 dark:text-violet-400">
                      Projected
                    </span>
                  )}
                  {month.isPast && !month.isCurrentMonth && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                      Historical
                    </span>
                  )}
                </div>

                {/* Surplus/Shortfall */}
                <div className={cn(
                  'rounded-lg p-3',
                  month.surplus >= 0 ? 'bg-green-500/10' : 'bg-red-500/10',
                )}>
                  <p className="text-xs text-muted-foreground">
                    {month.surplus >= 0 ? 'Surplus' : 'Shortfall'}
                  </p>
                  <p className={cn(
                    'text-xl font-bold',
                    month.surplus >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400',
                  )}>
                    {month.surplus >= 0 ? '+' : ''}{formatCents(month.surplus)}
                  </p>
                </div>

                {/* Mini Stats */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Income</p>
                    <p className="font-mono font-medium">{formatCents(month.income)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expenses</p>
                    <p className="font-mono font-medium">{formatCents(month.expenses)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Savings</p>
                    <p className="font-mono font-medium">{formatCents(month.savings)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Month View - detailed view */
        <>
          {/* Top Row: Surplus + Earned + Spent + Saved */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {/* Expected Surplus/Shortfall */}
            <div className={cn(
              'rounded-xl border p-4 text-center',
              headline.isPositive
                ? headline.hasPlan ? 'border-green-500/50 bg-green-500/5' : 'bg-card'
                : 'border-red-500/50 bg-red-500/5',
            )}>
              <div className={cn(
                'mx-auto flex h-9 w-9 items-center justify-center rounded-full',
                headline.isPositive ? 'bg-green-500/10' : 'bg-red-500/10',
              )}>
                {headline.isPositive ? (
                  <TrendingUp className={cn('h-4 w-4', headline.hasPlan ? 'text-green-500' : 'text-slate-500')} />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
              <p className={cn(
                'mt-2 text-xl font-bold',
                headline.isPositive
                  ? headline.hasPlan ? 'text-green-600 dark:text-green-400' : ''
                  : 'text-red-600 dark:text-red-400',
              )}>
                {headline.isPositive ? '+' : ''}{formatCents(headline.amount)}
              </p>
              <p className="text-xs text-muted-foreground">{headline.label}</p>
            </div>

            {/* Earned */}
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-green-500/10">
                <BanknoteArrowUp className="h-4 w-4 text-green-500" />
              </div>
              <p className="mt-2 text-xl font-bold">
                {formatCents(isFuturePeriod ? periodCashFlow.income.expected : periodCashFlow.income.actual)}
              </p>
              <p className="text-xs text-muted-foreground">
                {isFuturePeriod ? 'Expected' : 'Earned'}
              </p>
            </div>

            {/* Spent */}
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10">
                <BanknoteArrowDown className="h-4 w-4 text-red-500" />
              </div>
              <p className="mt-2 text-xl font-bold">
                {formatCents(isFuturePeriod ? periodCashFlow.budgeted.expected : periodCashFlow.expenses.actual)}
              </p>
              <p className="text-xs text-muted-foreground">
                {isFuturePeriod ? 'Planned' : 'Spent'}
              </p>
            </div>

            {/* Saved */}
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10">
                <PiggyBank className="h-4 w-4 text-blue-500" />
              </div>
              <p className="mt-2 text-xl font-bold">
                {formatCents(isFuturePeriod ? periodCashFlow.savings.expected : periodCashFlow.savings.actual)}
              </p>
              <p className="text-xs text-muted-foreground">
                {isFuturePeriod ? 'To Save' : 'Saved'}
              </p>
            </div>
          </div>

          {/* Budget Status with burn rate chart - full width */}
          {budgetStatus && (
            <div className={cn(
              'rounded-xl border p-5',
              budgetStatus.isPositive
                ? budgetStatus.hasBudget ? 'border-green-500/50 bg-green-500/5' : 'bg-card'
                : 'border-red-500/50 bg-red-500/5',
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  budgetStatus.isPositive ? 'bg-green-500/10' : 'bg-red-500/10',
                )}>
                  <Target className={cn('h-5 w-5', budgetStatus.isPositive ? 'text-green-500' : 'text-red-500')} />
                </div>
                <div className="flex-1">
                  <p className={cn(
                    'text-xl font-bold',
                    budgetStatus.isPositive
                      ? budgetStatus.hasBudget ? 'text-green-600 dark:text-green-400' : ''
                      : 'text-red-600 dark:text-red-400',
                  )}>
                    {budgetStatus.isPositive && budgetStatus.amount > 0 ? '+' : ''}{budgetStatus.amount > 0 ? formatCents(budgetStatus.amount) : '—'}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">{budgetStatus.label}</span>
                  </p>
                </div>
              </div>
              {/* Burn rate chart - larger now that it's full width */}
              {budgetStatus.hasBudget && burnRateData.totalBudget > 0 && (
                <div className="mt-4">
                  <BurnRateChart
                    dailySpending={burnRateData.dailySpending}
                    totalBudget={burnRateData.totalBudget}
                    periodStart={burnRateData.periodStart}
                    periodEnd={burnRateData.periodEnd}
                    periodLabel={burnRateData.periodLabel}
                    compact
                  />
                </div>
              )}
            </div>
          )}

          {/* Category Progress */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold">Category Progress</h3>

            {categoryProgress.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {isFuturePeriod
                  ? `No expenses expected for ${periodLabel}.`
                  : `No expenses recorded ${isCurrentPeriod ? 'this month' : `in ${periodLabel}`}.`}
              </p>
            ) : (
              <div className="space-y-4">
                {categoryProgress.map((item) => {
                  // Fixed-only categories show checkmark + "Paid"
                  if (item.isFixedOnly) {
                    return (
                      <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                        <div className="flex items-center gap-3">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              </TooltipTrigger>
                              <TooltipContent>Fixed expense — no variable budget</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Pin className="h-3 w-3 text-indigo-500" />
                          <span className="text-muted-foreground">Fixed</span>
                          <span className="font-mono">{formatCents(item.fixedAmount)}</span>
                        </div>
                      </div>
                    );
                  }

                  // Variable categories show progress bar
                  const hasBudget = item.budget > 0;
                  const isOverBudget = hasBudget && item.spent > item.budget;
                  const percentage = hasBudget ? Math.round((item.spent / item.budget) * 100) : 0;
                  const isWarning = percentage >= 80 && percentage < 100;

                  return (
                    <div key={item.id} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          {item.fixedAmount > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="flex items-center gap-1 rounded bg-indigo-500/10 px-1.5 py-0.5 text-xs text-indigo-600 dark:text-indigo-400">
                                    <Pin className="h-3 w-3" />
                                    {formatCents(item.fixedAmount)} fixed
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Includes {formatCents(item.fixedAmount)} in fixed expenses</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <span className={cn(
                          'font-mono',
                          isOverBudget ? 'text-red-500' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                        )}>
                          {hasBudget ? (
                            <>
                              {formatCents(item.spent)} of {formatCents(item.budget)}
                              <span className="ml-1">({percentage}%)</span>
                            </>
                          ) : (
                            formatCents(item.spent)
                          )}
                        </span>
                      </div>
                      <div className="relative h-2 rounded-full bg-muted">
                        <div
                          className={cn(
                            'absolute h-2 rounded-full',
                            isOverBudget ? 'bg-red-500' : isWarning ? 'bg-amber-500' : '',
                          )}
                          style={{
                            width: `${Math.min(percentage, 100)}%`,
                            backgroundColor: isOverBudget || isWarning ? undefined : item.color,
                          }}
                        />
                        {isOverBudget && (
                          <div className="absolute right-0 h-2 w-1 rounded-r-full bg-red-700" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline" asChild>
          <Link to="/money">
            <Receipt className="h-4 w-4" />
            View All Transactions
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/budget">
            <Target className="h-4 w-4" />
            Manage Budget
          </Link>
        </Button>
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
