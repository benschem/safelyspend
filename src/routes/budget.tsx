import { useMemo, useState } from 'react';
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
import { useScenarios } from '@/hooks/use-scenarios';
import { ScenarioSelector } from '@/components/scenario-selector';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { buildCategoryColorMap, CHART_COLORS } from '@/lib/chart-colors';
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
  const { allTransactions } = useTransactions();
  const { budgetRules } = useBudgetRules(activeScenarioId);
  const { activeCategories } = useCategories();

  // Selected period state - defaults to current month
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Calculate date range for selected period
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const selectedYear = selectedMonth.getFullYear();
  const selectedMonthIndex = selectedMonth.getMonth();

  // Period start/end depends on view mode
  const periodStart = viewMode === 'year'
    ? `${selectedYear}-01-01`
    : `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}-01`;
  // Get last day of month without timezone conversion
  const lastDayOfMonth = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
  const periodEnd = viewMode === 'year'
    ? `${selectedYear}-12-31`
    : `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

  // Check if viewing current, past, or future period
  const isCurrentPeriod = viewMode === 'year'
    ? today.slice(0, 4) === String(selectedYear)
    : today.slice(0, 7) === periodStart.slice(0, 7);
  const isFuturePeriod = periodStart > today;
  const isPastPeriod = periodEnd < today;
  // For current period, use today; for past use period end; for future use period start (no actuals)
  const effectiveDate = isCurrentPeriod ? today : (isFuturePeriod ? periodStart : periodEnd);

  const { expandedForecasts: periodForecasts, savingsForecasts } = useForecasts(activeScenarioId, periodStart, periodEnd);

  const shortMonthName = selectedMonth.toLocaleDateString('en-AU', { month: 'long' });
  const periodLabel = viewMode === 'year' ? String(selectedYear) : `${shortMonthName} ${selectedYear}`;
  const [pickerYear, setPickerYear] = useState(selectedYear);

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

  // Period cash flow calculation (works for both month and year view)
  const periodCashFlow = useMemo(() => {
    const daysInPeriod = viewMode === 'year'
      ? (selectedYear % 4 === 0 ? 366 : 365)
      : new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
    const effectiveDateObj = new Date(effectiveDate);
    const dayOfPeriod = isCurrentPeriod
      ? (viewMode === 'year'
        ? Math.ceil((effectiveDateObj.getTime() - new Date(selectedYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24)) + 1
        : effectiveDateObj.getDate())
      : daysInPeriod;

    // Get category IDs that have budgets
    const budgetedCategoryIds = new Set(budgetRules.map((r) => r.categoryId));

    // Expected income for full period
    const expectedIncome = periodForecasts
      .filter((f) => f.type === 'income')
      .reduce((sum, f) => sum + f.amountCents, 0);

    // Expected savings for full period (use savingsForecasts which includes interest)
    const expectedSavings = savingsForecasts
      .reduce((sum, f) => sum + f.amountCents, 0);

    // Expected expenses for full period
    const expectedExpenses = periodForecasts
      .filter((f) => f.type === 'expense')
      .reduce((sum, f) => sum + f.amountCents, 0);

    // Total budget for period (sum of all budget rules, converted to period)
    const periodMultiplier = viewMode === 'year' ? 12 : 1;
    const totalBudget = budgetRules.reduce((sum, r) => {
      let monthlyAmount: number;
      switch (r.cadence) {
        case 'weekly':
          monthlyAmount = r.amountCents * 4.33;
          break;
        case 'fortnightly':
          monthlyAmount = r.amountCents * 2.17;
          break;
        case 'monthly':
          monthlyAmount = r.amountCents;
          break;
        case 'quarterly':
          monthlyAmount = r.amountCents / 3;
          break;
        case 'yearly':
          monthlyAmount = r.amountCents / 12;
          break;
        default:
          monthlyAmount = r.amountCents;
      }
      return sum + monthlyAmount * periodMultiplier;
    }, 0);

    // Actual income received so far (or full period if past)
    const actualIncome = allTransactions
      .filter((t) => t.type === 'income' && t.date >= periodStart && t.date <= effectiveDate)
      .reduce((sum, t) => sum + t.amountCents, 0);

    // Actual savings so far
    const actualSavings = allTransactions
      .filter((t) => t.type === 'savings' && t.date >= periodStart && t.date <= effectiveDate)
      .reduce((sum, t) => sum + t.amountCents, 0);

    // Actual expenses - split by budgeted vs unbudgeted
    const expenseTransactionsThisPeriod = allTransactions.filter(
      (t) => t.type === 'expense' && t.date >= periodStart && t.date <= effectiveDate,
    );

    const actualBudgetedExpenses = expenseTransactionsThisPeriod
      .filter((t) => t.categoryId && budgetedCategoryIds.has(t.categoryId))
      .reduce((sum, t) => sum + t.amountCents, 0);

    const actualUnbudgetedExpenses = expenseTransactionsThisPeriod
      .filter((t) => !t.categoryId || !budgetedCategoryIds.has(t.categoryId))
      .reduce((sum, t) => sum + t.amountCents, 0);

    const actualExpenses = actualBudgetedExpenses + actualUnbudgetedExpenses;

    // Unallocated = Income - Budget - Savings
    const unallocated = Math.round(expectedIncome - totalBudget - expectedSavings);

    // Net for period = Income - Expenses - Savings (actual so far)
    const actualNet = actualIncome - actualExpenses - actualSavings;

    // Forecasted remaining income/expenses/savings for the rest of the period
    // For current period: forecasts after today
    // For future periods: all forecasts (no actuals exist yet)
    // For past periods: no remaining forecasts
    const forecastedIncome = isFuturePeriod
      ? periodForecasts.filter((f) => f.type === 'income').reduce((sum, f) => sum + f.amountCents, 0)
      : isCurrentPeriod
        ? periodForecasts.filter((f) => f.type === 'income' && f.date > effectiveDate).reduce((sum, f) => sum + f.amountCents, 0)
        : 0;
    const forecastedExpenses = isFuturePeriod
      ? periodForecasts.filter((f) => f.type === 'expense').reduce((sum, f) => sum + f.amountCents, 0)
      : isCurrentPeriod
        ? periodForecasts.filter((f) => f.type === 'expense' && f.date > effectiveDate).reduce((sum, f) => sum + f.amountCents, 0)
        : 0;
    const forecastedSavings = isFuturePeriod
      ? periodForecasts.filter((f) => f.type === 'savings').reduce((sum, f) => sum + f.amountCents, 0)
      : isCurrentPeriod
        ? periodForecasts.filter((f) => f.type === 'savings' && f.date > effectiveDate).reduce((sum, f) => sum + f.amountCents, 0)
        : 0;

    // Projected net for full period
    const projectedNet = actualNet + forecastedIncome - forecastedExpenses - forecastedSavings;
    const forecastedNet = forecastedIncome - forecastedExpenses - forecastedSavings;

    return {
      dayOfPeriod,
      daysInPeriod,
      income: { expected: Math.round(expectedIncome), actual: actualIncome },
      budgeted: { expected: Math.round(totalBudget), actual: actualBudgetedExpenses },
      unbudgeted: { unallocated: Math.max(0, unallocated), actual: actualUnbudgetedExpenses },
      savings: { expected: Math.round(expectedSavings), actual: actualSavings },
      expenses: { expected: Math.round(expectedExpenses), actual: actualExpenses },
      net: {
        projected: projectedNet,
        forecasted: forecastedNet,
      },
    };
  }, [periodForecasts, savingsForecasts, budgetRules, allTransactions, periodStart, effectiveDate, selectedYear, selectedMonthIndex, isCurrentPeriod, isFuturePeriod, viewMode]);

  // Summary stats for the cards
  const summary = useMemo(() => {
    // Calculate spending pace stats
    const daysInPeriod = viewMode === 'year'
      ? (selectedYear % 4 === 0 ? 366 : 365)
      : new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
    const effectiveDateObj = new Date(effectiveDate);
    const dayOfPeriod = isCurrentPeriod
      ? (viewMode === 'year'
        ? Math.ceil((effectiveDateObj.getTime() - new Date(selectedYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24)) + 1
        : effectiveDateObj.getDate())
      : daysInPeriod;
    const periodProgress = dayOfPeriod / daysInPeriod;

    let overCount = 0;
    let overspendingCount = 0;
    let goodCount = 0;

    const periodMultiplier = viewMode === 'year' ? 12 : 1;

    for (const rule of budgetRules) {
      // Convert to period budget
      let monthlyBudget = rule.amountCents;
      switch (rule.cadence) {
        case 'weekly':
          monthlyBudget = rule.amountCents * 4.33;
          break;
        case 'fortnightly':
          monthlyBudget = rule.amountCents * 2.17;
          break;
        case 'quarterly':
          monthlyBudget = rule.amountCents / 3;
          break;
        case 'yearly':
          monthlyBudget = rule.amountCents / 12;
          break;
      }
      const periodBudget = monthlyBudget * periodMultiplier;

      const spent = allTransactions
        .filter((t) => t.type === 'expense' && t.categoryId === rule.categoryId && t.date >= periodStart && t.date <= effectiveDate)
        .reduce((sum, t) => sum + t.amountCents, 0);

      const spentPercent = periodBudget > 0 ? spent / periodBudget : 0;
      const expectedSpend = periodBudget * periodProgress;
      const burnRate = expectedSpend > 0 ? spent / expectedSpend : 0;

      if (spentPercent >= 1) {
        overCount++;
      } else if (burnRate > 1.2) {
        overspendingCount++;
      } else {
        goodCount++;
      }
    }

    // Savings forecasted
    const totalSavingsForecasted = periodForecasts
      .filter((f) => f.type === 'savings')
      .reduce((sum, f) => sum + f.amountCents, 0);

    return {
      overCount,
      overspendingCount,
      goodCount,
      trackedCount: budgetRules.length,
      totalSavingsForecasted,
    };
  }, [budgetRules, allTransactions, periodForecasts, periodStart, effectiveDate, selectedYear, selectedMonthIndex, isCurrentPeriod, viewMode]);

  // Calculate selected period's spending by category for horizontal bar chart
  const periodSpending = useMemo(() => {
    const expenseTransactions = allTransactions.filter(
      (t) => t.type === 'expense' && t.date >= periodStart && t.date <= effectiveDate,
    );

    // Build budget lookup (converted to period amounts)
    const periodMultiplier = viewMode === 'year' ? 12 : 1;
    const budgetByCategory = new Map<string, number>();
    for (const rule of budgetRules) {
      let monthlyBudget = rule.amountCents;
      switch (rule.cadence) {
        case 'weekly':
          monthlyBudget = rule.amountCents * 4.33;
          break;
        case 'fortnightly':
          monthlyBudget = rule.amountCents * 2.17;
          break;
        case 'quarterly':
          monthlyBudget = rule.amountCents / 3;
          break;
        case 'yearly':
          monthlyBudget = rule.amountCents / 12;
          break;
      }
      budgetByCategory.set(rule.categoryId, Math.round(monthlyBudget * periodMultiplier));
    }

    const byCategory: Record<string, number> = {};
    let uncategorized = 0;
    let total = 0;

    for (const tx of expenseTransactions) {
      total += tx.amountCents;
      if (tx.categoryId) {
        byCategory[tx.categoryId] = (byCategory[tx.categoryId] ?? 0) + tx.amountCents;
      } else {
        uncategorized += tx.amountCents;
      }
    }

    const categorySpending = activeCategories
      .map((c) => ({
        id: c.id,
        name: c.name,
        amount: byCategory[c.id] ?? 0,
        budget: budgetByCategory.get(c.id) ?? 0,
      }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    if (uncategorized > 0) {
      categorySpending.push({ id: 'uncategorized', name: 'Uncategorised', amount: uncategorized, budget: 0 });
    }

    return { categorySpending, total };
  }, [allTransactions, activeCategories, budgetRules, periodStart, effectiveDate, viewMode]);

  // Build color map for spending chart
  const colorMap = useMemo(() => {
    const categoryIds = activeCategories.map((c) => c.id);
    return buildCategoryColorMap(categoryIds);
  }, [activeCategories]);

  // Burn rate data for mini pace chart
  const burnRateData = useMemo(() => {
    // Get daily expense spending within this period
    const expenses = allTransactions.filter(
      (t) => t.type === 'expense' && t.date >= periodStart && t.date <= periodEnd,
    );

    const dailySpending = expenses.map((t) => ({
      date: t.date,
      amount: t.amountCents,
    }));

    // Calculate total budget for the period
    const periodMultiplier = viewMode === 'year' ? 12 : 1;
    const totalBudget = budgetRules.reduce((sum, r) => {
      let monthlyAmount: number;
      switch (r.cadence) {
        case 'weekly':
          monthlyAmount = r.amountCents * 4.33;
          break;
        case 'fortnightly':
          monthlyAmount = r.amountCents * 2.17;
          break;
        case 'monthly':
          monthlyAmount = r.amountCents;
          break;
        case 'quarterly':
          monthlyAmount = r.amountCents / 3;
          break;
        case 'yearly':
          monthlyAmount = r.amountCents / 12;
          break;
        default:
          monthlyAmount = r.amountCents;
      }
      return sum + monthlyAmount * periodMultiplier;
    }, 0);

    return {
      dailySpending,
      totalBudget: Math.round(totalBudget),
      periodStart,
      periodEnd,
      periodLabel,
    };
  }, [allTransactions, budgetRules, periodStart, periodEnd, periodLabel, viewMode]);

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500/10">
              <Target className="h-5 w-5 text-slate-500" />
            </div>
            Budget
          </h1>
          <p className="mt-1 text-muted-foreground">Track your spending against your plan</p>
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

        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Select a scenario to track your budget.</p>
          <Button asChild className="mt-4">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500/10">
            <Target className="h-5 w-5 text-slate-500" />
          </div>
          Budget
        </h1>
        <p className="mt-1 text-muted-foreground">Track your spending against your plan</p>
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
        {/* Income */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Income</p>
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
                  {pct}% earned of {formatCents(periodCashFlow.income.expected)} forecast
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
          <p className="mt-4 text-sm text-muted-foreground">Budgeted</p>
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
                  {pct}% spent of {formatCents(periodCashFlow.budgeted.expected)} limit
                </p>
              </>
            );
          })()}
        </div>

        {/* Unallocated Spending */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
            <CircleAlert className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Unallocated</p>
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
                  {pct}% spent of {formatCents(periodCashFlow.unbudgeted.unallocated)} available
                </p>
              </>
            );
          })()}
        </div>

        {/* Savings */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
            <PiggyBank className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Savings</p>
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
                  {pct}% saved of {formatCents(periodCashFlow.savings.expected)} planned
                </p>
              </>
            );
          })()}
        </div>
      </div>

      {/* Net, Pace & Speed Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Net Change */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            {periodCashFlow.net.projected >= 0 ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
                <TrendingDown className="h-4 w-4 text-red-500" />
              </div>
            )}
            <p className="text-sm text-muted-foreground">Net change</p>
          </div>
          <p className={`mt-2 text-3xl font-bold ${periodCashFlow.net.projected >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {periodCashFlow.net.projected >= 0 ? '+' : ''}{formatCents(periodCashFlow.net.projected)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {isPastPeriod
              ? 'Actual'
              : isFuturePeriod
                ? 'Projected'
                : periodCashFlow.net.forecasted !== 0
                  ? `Includes ${formatCents(Math.abs(periodCashFlow.net.forecasted))} forecast`
                  : 'Actual to date'}
          </p>
        </div>

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

        {/* Spending Speed */}
        {(() => {
          // Calculate severity based on percentage of budgets affected
          const overPercent = summary.trackedCount > 0 ? summary.overCount / summary.trackedCount : 0;
          const isCritical = overPercent > 0.25; // More than 25% exceeded
          const hasExceeded = summary.overCount > 0;
          const hasOverspending = summary.overspendingCount > 0;

          let label: string;
          let description: string;
          let iconBg: string;
          let iconColor: string;
          let textColor: string;

          if (isCritical) {
            label = 'Too Fast';
            description = `${summary.overCount} of ${summary.trackedCount} budgets exceeded`;
            iconBg = 'bg-red-500/10';
            iconColor = 'text-red-500';
            textColor = 'text-red-600';
          } else if (hasExceeded) {
            label = 'Over Budget';
            description = `${summary.overCount} of ${summary.trackedCount} budgets exceeded`;
            iconBg = 'bg-amber-500/10';
            iconColor = 'text-amber-500';
            textColor = 'text-amber-600';
          } else if (hasOverspending) {
            label = 'Speeding Up';
            description = `${summary.overspendingCount} of ${summary.trackedCount} budgets overspending`;
            iconBg = 'bg-amber-500/10';
            iconColor = 'text-amber-500';
            textColor = 'text-amber-600';
          } else {
            label = 'On Track';
            description = `${summary.goodCount} of ${summary.trackedCount} budgets on pace`;
            iconBg = 'bg-green-500/10';
            iconColor = 'text-green-500';
            textColor = 'text-green-600';
          }

          return (
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>
                  <CircleGauge className={`h-4 w-4 ${iconColor}`} />
                </div>
                <p className="text-sm text-muted-foreground">Spending speed</p>
              </div>
              <p className={`mt-2 text-3xl font-bold ${textColor}`}>
                {label}
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
