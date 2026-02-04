import { useState, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  PiggyBank,
  Banknote,
  BanknoteArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  History,
  Pin,
  Tag,
  Sparkles,
  Gauge,
} from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { useScenarioDiff } from '@/hooks/use-scenario-diff';

import { useForecasts } from '@/hooks/use-forecasts';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useCategories } from '@/hooks/use-categories';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useTransactions } from '@/hooks/use-transactions';

import { useBudgetPeriodData } from '@/hooks/use-budget-period-data';
import { useCashSurplus } from '@/hooks/use-cash-surplus';
import { useWhatIf } from '@/contexts/what-if-context';
import { BurnRateChart } from '@/components/charts/burn-rate-chart';
import { CHART_COLORS } from '@/lib/chart-colors';
import { cn, formatCents, toMonthlyCents, type CadenceType } from '@/lib/utils';
import type { ForecastRule } from '@/lib/types';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface OutletContext {
  activeScenarioId: string | null;
}

export function CashFlowPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario, isLoading } = useScenarios();

  if (isLoading) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <h1 className="page-title">
            <div className="page-title-icon bg-sky-500/10">
              <Banknote className="h-5 w-5 text-sky-500" />
            </div>
            Cash Flow
          </h1>
          <p className="page-description">Track your spending against your plan</p>
        </div>
      </div>
    );
  }

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="page-shell space-y-6">
        <div className="page-header">
          <h1 className="page-title">
            <div className="page-title-icon bg-sky-500/10">
              <Banknote className="h-5 w-5 text-sky-500" />
            </div>
            Cash Flow
          </h1>
          <p className="page-description">Track your spending against your plan</p>
        </div>

        <div className="empty-state">
          <p className="empty-state-text">Select a scenario from the banner to view your cash flow.</p>
          <Button asChild className="empty-state-action">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <CashFlowContent activeScenarioId={activeScenarioId} />;
}

interface CashFlowContentProps {
  activeScenarioId: string;
}

function CashFlowContent({ activeScenarioId }: CashFlowContentProps) {
  const { activeScenario } = useScenarios();
  const { isViewingDefault, defaultBudgetByCategoryMonthly, defaultTotals } = useScenarioDiff();
  const { isWhatIfMode } = useWhatIf();
  const { budgetRules } = useBudgetRules(activeScenarioId);
  const { categories } = useCategories();
  const { savingsGoals } = useSavingsGoals();
  const { allTransactions } = useTransactions();
  // Selected period state - defaults to current month
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());

  // Get forecast date range for the selected month
  const forecastDateRange = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }, [selectedMonth]);

  const { rules: forecastRules } = useForecasts(
    activeScenarioId,
    forecastDateRange.startDate,
    forecastDateRange.endDate,
  );

  // Get expense rules for fixed category detection
  const expenseRules = useMemo(
    () => forecastRules.filter((r) => r.type === 'expense'),
    [forecastRules],
  );

  const savingsRules = useMemo(
    () => forecastRules.filter((r) => r.type === 'savings'),
    [forecastRules],
  );

  // Use the extracted hook for all business logic
  const {
    periodStart,
    periodEnd,
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
    viewMode: 'month',
  });

  // Show deltas when viewing non-default scenario OR when there are What-If adjustments
  // but never for past periods — comparing historical actuals to plan deltas is confusing
  const showDeltas = (!isViewingDefault || isWhatIfMode) && !isPastPeriod;

  // Navigation handlers
  const goToPrevious = () => {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNext = () => {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToCurrent = () => {
    setSelectedMonth(new Date());
  };

  const selectedYear = selectedMonth.getFullYear();
  const selectedMonthIndex = selectedMonth.getMonth();

  // Calculate fixed expenses per category for this period
  const fixedExpensesPerCategory = useMemo(() => {
    const result: Record<string, { amount: number; rules: ForecastRule[] }> = {};

    for (const rule of expenseRules) {
      if (rule.categoryId) {
        if (!result[rule.categoryId]) {
          result[rule.categoryId] = { amount: 0, rules: [] };
        }
        // Convert to monthly
        const monthlyAmount = toMonthlyCents(rule.amountCents, rule.cadence as CadenceType);
        const catData = result[rule.categoryId];
        if (catData) {
          catData.amount += monthlyAmount;
          catData.rules.push(rule);
        }
      }
    }

    return result;
  }, [expenseRules]);

  // Calculate variable budgets per category for this period
  const variableBudgetsPerCategory = useMemo(() => {
    const result: Record<string, number> = {};

    for (const rule of budgetRules) {
      const monthlyAmount = toMonthlyCents(rule.amountCents, rule.cadence as CadenceType);
      result[rule.categoryId] = monthlyAmount;
    }

    return result;
  }, [budgetRules]);

  // Effective date for filtering actuals (today for current period, period end for past)
  const effectiveDate = useMemo(() => {
    if (isCurrentPeriod) {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return periodEnd;
  }, [isCurrentPeriod, periodEnd]);

  // Compute remaining flows for cash surplus projection
  // Uses the same periodCashFlow data as Monthly Net so both metrics move with scenario changes
  const remainingFlows = useMemo(() => {
    if (isPastPeriod) return { remainingIncome: 0, remainingExpenses: 0 };

    const hasPlan =
      periodCashFlow.income.expected > 0 ||
      periodCashFlow.budgeted.expected > 0 ||
      periodCashFlow.expenses.expected > 0;

    if (isCurrentPeriod) {
      // No plan: can't project forward, cash surplus = current balance
      if (!hasPlan) return { remainingIncome: 0, remainingExpenses: 0 };
      // Remaining income = expected total - already received (clamped: over-actual is already in balance)
      const remainingIncome = Math.max(0, periodCashFlow.income.expected - periodCashFlow.income.actual);
      // Remaining outflows = projected expenses + remaining savings (clamped to 0)
      const remainingExpenses = Math.max(0, periodCashFlow.projection.projectedTotal - periodCashFlow.expenses.actual);
      const remainingSavings = Math.max(0, periodCashFlow.savings.expected - periodCashFlow.savings.actual);
      return { remainingIncome, remainingExpenses: remainingExpenses + remainingSavings };
    }

    // Future: full period expected amounts
    return {
      remainingIncome: periodCashFlow.income.expected,
      remainingExpenses: periodCashFlow.expenses.expected + periodCashFlow.budgeted.expected + periodCashFlow.savings.expected,
    };
  }, [isPastPeriod, isCurrentPeriod, periodCashFlow]);

  const cashSurplusData = useCashSurplus({
    periodEnd,
    isPastPeriod,
    remainingIncome: remainingFlows.remainingIncome,
    remainingExpenses: remainingFlows.remainingExpenses,
  });

  // Build category progress data
  const categoryProgress = useMemo(() => {
    const mapItem = (
      id: string,
      name: string,
      spent: number,
    ) => {
      const fixedData = fixedExpensesPerCategory[id];
      const variableBudget = variableBudgetsPerCategory[id] ?? 0;
      const isFixedOnly = fixedData && fixedData.amount > 0 && variableBudget === 0;
      const totalBudget = (fixedData?.amount ?? 0) + variableBudget;
      return {
        id,
        name: id === 'uncategorized' ? 'Unplanned' : name,
        spent,
        budget: totalBudget,
        isFixedOnly,
        fixedAmount: fixedData?.amount ?? 0,
        color: colorMap[id] ?? CHART_COLORS.uncategorized,
      };
    };

    if (isFuturePeriod) {
      return forecastExpenses.map((cat) => mapItem(cat.id, cat.name, cat.amount));
    }

    // For current/past periods, start with categories that have actual spending
    const spendingCatIds = new Set(periodSpending.categorySpending.map((c) => c.id));
    const result = periodSpending.categorySpending.map((cat) =>
      mapItem(cat.id, cat.name, cat.amount),
    );

    // Add fixed expense categories that don't have actual spending yet
    for (const [catId] of Object.entries(fixedExpensesPerCategory)) {
      if (!spendingCatIds.has(catId)) {
        const category = categories.find((c) => c.id === catId);
        if (category && !category.isArchived) {
          result.push(mapItem(catId, category.name, 0));
        }
      }
    }

    // Sort: non-fixed items first, then fixed-only items
    return result.sort((a, b) => Number(a.isFixedOnly) - Number(b.isFixedOnly));
  }, [
    isFuturePeriod,
    forecastExpenses,
    periodSpending,
    fixedExpensesPerCategory,
    variableBudgetsPerCategory,
    colorMap,
    categories,
  ]);

  // Build savings progress data
  const savingsProgress = useMemo(() => {
    // Expected per goal from rules (monthly amounts)
    const expectedByGoal = new Map<string, number>();
    for (const rule of savingsRules) {
      if (rule.savingsGoalId) {
        const monthly = toMonthlyCents(rule.amountCents, rule.cadence as CadenceType);
        expectedByGoal.set(
          rule.savingsGoalId,
          (expectedByGoal.get(rule.savingsGoalId) ?? 0) + monthly,
        );
      }
    }

    // Actual per goal from transactions in the period
    const actualByGoal = new Map<string, number>();
    const savingsTx = allTransactions.filter(
      (t) =>
        t.type === 'savings' &&
        t.savingsGoalId &&
        t.date >= periodStart &&
        t.date <= effectiveDate,
    );
    for (const tx of savingsTx) {
      actualByGoal.set(
        tx.savingsGoalId!,
        (actualByGoal.get(tx.savingsGoalId!) ?? 0) + tx.amountCents,
      );
    }

    // Combine all goals that have either expected or actual
    const goalIds = new Set([...expectedByGoal.keys(), ...actualByGoal.keys()]);
    return Array.from(goalIds)
      .map((goalId) => {
        const goal = savingsGoals.find((g) => g.id === goalId);
        return {
          id: goalId,
          name: goal?.name ?? 'Unknown',
          actual: actualByGoal.get(goalId) ?? 0,
          expected: expectedByGoal.get(goalId) ?? 0,
        };
      })
      .filter((g) => g.actual !== 0 || g.expected > 0)
      .sort((a, b) => b.expected - a.expected);
  }, [savingsRules, allTransactions, savingsGoals, periodStart, effectiveDate]);

  // Calculate surplus for safe limit line
  const surplus = useMemo(() => {
    return (
      periodCashFlow.income.expected -
      periodCashFlow.expenses.expected -
      periodCashFlow.budgeted.expected -
      periodCashFlow.savings.expected
    );
  }, [periodCashFlow]);

  const hasSurplusBuffer = surplus > 0;

  // Calculate budget status (spending pace vs budget)
  const budgetStatus = useMemo(() => {
    const totalBudget = periodCashFlow.expenses.expected + periodCashFlow.budgeted.expected;
    const actualSpending = periodCashFlow.expenses.actual;
    const hasBudget = totalBudget > 0;

    if (isFuturePeriod) {
      return null; // No spending yet, doesn't make sense to show
    }

    if (!hasBudget) {
      return {
        amount: actualSpending,
        label: 'Spent (no budget set)',
        isPositive: true,
        hasBudget: false,
      };
    }

    // For past periods, compare actual to full budget
    if (isPastPeriod) {
      const diff = totalBudget - actualSpending;
      if (diff > 0) {
        return { amount: 0, label: `Spent ${formatCents(diff)} under budget`, isPositive: true, hasBudget: true };
      } else if (diff < 0) {
        return {
          amount: 0,
          label: `Spent ${formatCents(Math.abs(diff))} over budget`,
          isPositive: false,
          hasBudget: true,
        };
      } else {
        return { amount: 0, label: 'Spent exactly on budget', isPositive: true, hasBudget: true };
      }
    }

    // For current period, compare pace: expected spending by now vs actual
    const periodProgress = periodCashFlow.dayOfPeriod / periodCashFlow.daysInPeriod;
    const expectedByNow = Math.round(totalBudget * periodProgress);
    const burnRate = expectedByNow > 0 ? Math.round((actualSpending / expectedByNow) * 100) : 0;

    // Smart projection: use fixed + variable split instead of naive linear extrapolation
    // "In the red" = projected spending exceeds budget + surplus buffer
    const projectedPercent = totalBudget > 0 ? (periodCashFlow.projection.projectedTotal / totalBudget) * 100 : 0;
    const safeLimitPercent = hasSurplusBuffer ? 100 + (surplus / totalBudget) * 100 : 100;
    const projectedInTheRed = projectedPercent > safeLimitPercent;

    // Descriptive message based on burn rate
    if (projectedInTheRed) {
      return {
        amount: 0,
        label: 'Spending too fast,',
        sublabel: 'going backwards.',
        isPositive: false,
        hasBudget: true,
      };
    } else if (burnRate > 150) {
      return {
        amount: 0,
        label: 'Spending too fast,',
        sublabel: hasSurplusBuffer ? 'but you have surplus buffer.' : 'slow down.',
        isPositive: hasSurplusBuffer,
        hasBudget: true,
      };
    } else if (burnRate > 120) {
      return {
        amount: 0,
        label: 'Spending faster than your budget allows,',
        sublabel: hasSurplusBuffer ? 'but you have surplus buffer.' : 'consider slowing down.',
        isPositive: hasSurplusBuffer,
        hasBudget: true,
      };
    } else if (burnRate > 100) {
      return {
        amount: 0,
        label: 'Slightly ahead of your budget.',
        sublabel: undefined as string | undefined,
        isPositive: false,
        hasBudget: true,
      };
    } else {
      return {
        amount: 0,
        label: 'On track with your budget,',
        sublabel: 'keep it up!',
        isPositive: true,
        hasBudget: true,
      };
    }
  }, [isFuturePeriod, isPastPeriod, periodCashFlow, hasSurplusBuffer, surplus]);

  if (isLoading) {
    return null;
  }

  // Whether the selected month is the current month (can't go further forward)
  const now = new Date();
  const isAtCurrentMonth =
    selectedMonth.getFullYear() === now.getFullYear() &&
    selectedMonth.getMonth() === now.getMonth();

  return (
    <div className="page-shell space-y-6">
      <div className="page-header flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">
            <div className="page-title-icon bg-sky-500/10">
              <Banknote className="h-5 w-5 text-sky-500" />
            </div>
            Cash Flow
          </h1>
          <p className="page-description">Track your spending against your plan</p>
        </div>
        <div className="flex items-center gap-2">
          <Popover
            open={calendarOpen}
            onOpenChange={(open) => {
              setCalendarOpen(open);
              if (open) setPickerYear(selectedYear);
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 w-44 cursor-pointer items-center justify-between rounded-md border border-input bg-background px-3 text-sm shadow-sm hover:bg-muted/50"
              >
                <span>{periodLabel}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              {/* Year navigation */}
              <div className="mb-3 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPickerYear((y) => y - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold">{pickerYear}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPickerYear((y) => y + 1)}
                  disabled={pickerYear >= now.getFullYear()}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {/* Month grid */}
              <div className="grid grid-cols-3 gap-1">
                {MONTHS.map((month, index) => {
                  const isSelected =
                    pickerYear === selectedYear && index === selectedMonthIndex;
                  const isCurrent =
                    pickerYear === now.getFullYear() && index === now.getMonth();
                  const isFutureMonth =
                    pickerYear > now.getFullYear() ||
                    (pickerYear === now.getFullYear() && index > now.getMonth());
                  return (
                    <Button
                      key={month}
                      variant={isSelected ? 'default' : 'ghost'}
                      size="sm"
                      disabled={isFutureMonth}
                      className={cn(
                        'h-8 text-xs',
                        isCurrent && !isSelected && 'border border-primary',
                      )}
                      onClick={() => {
                        setSelectedMonth(new Date(pickerYear, index, 1));
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
          <Button variant="ghost" size="icon" onClick={goToPrevious} className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNext}
            className="h-9 w-9"
            disabled={isAtCurrentMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentPeriod && (
            <Button variant="ghost" size="sm" onClick={goToCurrent} className="text-xs">
              Today →
            </Button>
          )}
        </div>
      </div>

      {/* Cash Flow Ledger */}
      <CashFlowLedger
        periodLabel={periodLabel}
        isCurrentPeriod={isCurrentPeriod}
        isPastPeriod={isPastPeriod}
        periodCashFlow={periodCashFlow}
        cashSurplusData={cashSurplusData}
        showDeltas={showDeltas}
        defaultTotals={defaultTotals}
      />

      {/* Burn rate chart (current period only) */}
      {isCurrentPeriod && budgetStatus?.hasBudget && burnRateData.totalBudget > 0 && (
        <div className={cn('rounded-xl border bg-card p-6', showDeltas && 'border-violet-500/30')}>
          <div className="mb-4 flex items-center gap-2">
            <Gauge className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Spending Pace</h3>
          </div>
          <p
            className={`mb-3 text-xs ${showDeltas ? 'text-violet-600 dark:text-violet-400' : 'invisible'}`}
          >
            {isWhatIfMode && isViewingDefault
              ? 'Based on your adjustments'
              : `Based on "${activeScenario?.name ?? 'scenario'}"`}
          </p>
          <BurnRateChart
            dailySpending={burnRateData.dailySpending}
            totalBudget={burnRateData.totalBudget}
            periodStart={burnRateData.periodStart}
            periodEnd={burnRateData.periodEnd}
            periodLabel={burnRateData.periodLabel}
            viewMode="month"
            surplusAmount={hasSurplusBuffer ? surplus : undefined}
            fixedExpenseSchedule={burnRateData.fixedExpenseSchedule}
            variableBudget={burnRateData.variableBudget}
            fixedExpensesTotal={burnRateData.fixedExpensesTotal}
          />
        </div>
      )}

      {/* Expenses & Savings Breakdown */}
      <div
        className={cn('rounded-xl border bg-card p-6', showDeltas && 'border-violet-500/30')}
      >
        <div className="mb-4 flex items-center gap-2">
          <BanknoteArrowDown className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">
            Spending over {periodLabel}
            {isCurrentPeriod && ' to date'}
          </h3>
        </div>
        <p
          className={`mb-3 text-xs ${showDeltas ? 'text-violet-600 dark:text-violet-400' : 'invisible'}`}
        >
          {isWhatIfMode && isViewingDefault
            ? 'Based on your adjustments'
            : `Based on "${activeScenario?.name ?? 'scenario'}"`}
        </p>

        {categoryProgress.length === 0 && savingsProgress.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {isFuturePeriod
              ? `No expenses or savings expected for ${periodLabel}.`
              : `No expenses or savings recorded ${isCurrentPeriod ? 'this month' : `in ${periodLabel}`}.`}
          </p>
        ) : (
          <div className="space-y-4">
            {categoryProgress.map((item) => {
              // Fixed-only categories show checkmark + "Paid"
              if (item.isFixedOnly) {
                return (
                  <Link
                    key={item.id}
                    to={`/categories/${item.id}`}
                    className="block space-y-2 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{item.name}</span>
                        <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                          <Pin className="h-3 w-3" />
                          Fixed
                        </span>
                      </div>
                      <span className="font-mono text-muted-foreground">
                        {formatCents(item.fixedAmount)}
                      </span>
                    </div>
                    <div className="relative h-2 rounded-full bg-muted">
                      <div
                        className="absolute h-2 rounded-full bg-green-500"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </Link>
                );
              }

              // Variable categories show progress bar
              const hasBudget = item.budget > 0;
              const isOverBudget = hasBudget && item.spent > item.budget;
              const percentage = hasBudget ? Math.round((item.spent / item.budget) * 100) : 0;
              const isWarning = percentage >= 80 && percentage < 100;

              return (
                <Link
                  key={item.id}
                  to={`/categories/${item.id}`}
                  className="block space-y-2 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{item.name}</span>
                      {item.fixedAmount > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                                <Pin className="h-3 w-3" />
                                {formatCents(item.fixedAmount)} fixed
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Includes {formatCents(item.fixedAmount)} in fixed expenses
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <span
                      className={cn(
                        'font-mono',
                        isOverBudget
                          ? 'text-red-500'
                          : isWarning
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground',
                      )}
                    >
                      {hasBudget ? (
                        <>
                          {formatCents(item.spent)} of budgeted {formatCents(item.budget)}
                          {(() => {
                            // In month view, compare monthly budgets directly
                            const defaultBudget = defaultBudgetByCategoryMonthly[item.id] ?? 0;
                            const currentBudget = variableBudgetsPerCategory[item.id] ?? 0;
                            const delta = currentBudget - defaultBudget;
                            const showDelta = showDeltas && delta !== 0;
                            return (
                              <span
                                className={`ml-1 inline-block min-w-[3.5rem] ${showDelta ? 'text-violet-600 dark:text-violet-400' : 'invisible'}`}
                              >
                                ({delta > 0 ? '+' : ''}
                                {formatCents(delta)})
                              </span>
                            );
                          })()}
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
                </Link>
              );
            })}

            {/* Savings Contributions */}
            {savingsProgress.length > 0 && (
              <>
                {categoryProgress.length > 0 && (
                  <div className="flex items-center gap-3 pt-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <PiggyBank className="h-3 w-3" />
                      Contributions to Savings
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                {savingsProgress.map((goal) => {
                  const hasExpected = goal.expected > 0;
                  const percentage = hasExpected
                    ? Math.round((goal.actual / goal.expected) * 100)
                    : 0;

                  return (
                    <div key={goal.id} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
                        <div className="flex items-center gap-2">
                          <PiggyBank className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{goal.name}</span>
                        </div>
                        <span className="font-mono text-muted-foreground">
                          {isFuturePeriod ? (
                            formatCents(goal.expected)
                          ) : hasExpected ? (
                            <>
                              {formatCents(goal.actual)} of {formatCents(goal.expected)}
                              <span className="ml-1">({percentage}%)</span>
                            </>
                          ) : (
                            formatCents(goal.actual)
                          )}
                        </span>
                      </div>
                      {hasExpected && (
                        <div className="relative h-2 rounded-full bg-muted">
                          <div
                            className="absolute h-2 rounded-full bg-blue-500"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

// --- Cash Flow Ledger ---

interface CashFlowLedgerProps {
  periodLabel: string;
  isCurrentPeriod: boolean;
  isPastPeriod: boolean;
  periodCashFlow: {
    income: { expected: number; actual: number };
    budgeted: { expected: number; actual: number };
    savings: { expected: number; actual: number };
    expenses: { expected: number; actual: number; dueToDate: number };
    projection: { variableActual: number; projectedVariable: number; projectedTotal: number };
  };
  cashSurplusData: {
    currentBalance: number | null;
    cashSurplus: number | null;
    hasAnchor: boolean;
  };
  showDeltas: boolean;
  defaultTotals: {
    income: number;
    fixedExpenses: number;
    budgetedExpenses: number;
    savings: number;
    surplus: number;
  };
}

function CashFlowLedger({
  periodLabel,
  isCurrentPeriod,
  isPastPeriod,
  periodCashFlow,
  cashSurplusData,
  showDeltas,
  defaultTotals,
}: CashFlowLedgerProps) {
  // Mobile: toggle between columns (past period only)
  const [mobileColumn, setMobileColumn] = useState<'left' | 'right'>('left');

  // Derive starting balance by undoing actuals from current balance
  const startingBalance = useMemo(() => {
    if (cashSurplusData.currentBalance === null) return null;
    return (
      cashSurplusData.currentBalance -
      periodCashFlow.income.actual +
      periodCashFlow.expenses.actual +
      periodCashFlow.savings.actual
    );
  }, [cashSurplusData.currentBalance, periodCashFlow.income.actual, periodCashFlow.expenses.actual, periodCashFlow.savings.actual]);

  const hasAnchor = cashSurplusData.hasAnchor && startingBalance !== null;

  // Scenario deltas (per-row)
  const incomeDelta = showDeltas ? periodCashFlow.income.expected - defaultTotals.income : 0;
  const fixedDelta = showDeltas ? periodCashFlow.expenses.expected - defaultTotals.fixedExpenses : 0;
  const variableDelta = showDeltas ? periodCashFlow.budgeted.expected - defaultTotals.budgetedExpenses : 0;
  const savingsDelta = showDeltas ? periodCashFlow.savings.expected - defaultTotals.savings : 0;
  const endDelta = showDeltas ? incomeDelta - fixedDelta - variableDelta - savingsDelta : 0;

  const renderDelta = (delta: number) => {
    if (!showDeltas || delta === 0) return null;
    return (
      <span className="ml-1.5 text-xs text-violet-600 dark:text-violet-400">
        ({delta > 0 ? '+' : ''}{formatCents(delta)})
      </span>
    );
  };

  const fmtSigned = (amount: number, prefix: string) => `${prefix}${formatCents(Math.abs(amount))}`;

  // --- Past period: two-column layout (Planned vs Actual) ---
  if (isPastPeriod) {
    const plannedEnd = hasAnchor
      ? (startingBalance as number) + periodCashFlow.income.expected - periodCashFlow.expenses.expected - periodCashFlow.budgeted.expected - periodCashFlow.savings.expected
      : null;
    const actualEnd = cashSurplusData.cashSurplus;
    const actualFixed = Math.max(0, periodCashFlow.expenses.actual - periodCashFlow.projection.variableActual);

    return (
      <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
        <LedgerHeader periodLabel={periodLabel} isCurrentPeriod={false} isPastPeriod />

        {/* Mobile tabs */}
        <div className="mt-3 flex gap-1 sm:hidden">
          <button
            type="button"
            onClick={() => setMobileColumn('left')}
            className={cn(
              'cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mobileColumn === 'left'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            Planned
          </button>
          <button
            type="button"
            onClick={() => setMobileColumn('right')}
            className={cn(
              'cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mobileColumn === 'right'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            Actual
          </button>
        </div>

        <div className="mt-4">
          {/* Column headers (desktop) */}
          <div className="mb-2 hidden sm:grid sm:grid-cols-[1fr_auto_auto] sm:gap-x-4">
            <div />
            <div className="w-28 text-right text-xs font-medium text-muted-foreground">Planned</div>
            <div className="w-28 text-right text-xs font-medium text-muted-foreground">Actual</div>
          </div>

          <TwoColRow label="Starting cash" left={hasAnchor ? formatCents(startingBalance as number) : '—'} right={hasAnchor ? formatCents(startingBalance as number) : '—'} mobileColumn={mobileColumn} />
          <TwoColRow label="+ Income" left={fmtSigned(periodCashFlow.income.expected, '+')} right={fmtSigned(periodCashFlow.income.actual, '+')} mobileColumn={mobileColumn} className="text-green-600 dark:text-green-400" />
          <TwoColRow label="− Fixed expenses" left={periodCashFlow.expenses.expected > 0 ? fmtSigned(periodCashFlow.expenses.expected, '−') : '—'} right={actualFixed > 0 ? fmtSigned(actualFixed, '−') : '—'} mobileColumn={mobileColumn} />
          <TwoColRow label="− Variable spending" left={periodCashFlow.budgeted.expected > 0 ? fmtSigned(periodCashFlow.budgeted.expected, '−') : '—'} right={periodCashFlow.projection.variableActual > 0 ? fmtSigned(periodCashFlow.projection.variableActual, '−') : '—'} mobileColumn={mobileColumn} />
          <TwoColRow label="− Savings" left={periodCashFlow.savings.expected > 0 ? fmtSigned(periodCashFlow.savings.expected, '−') : '—'} right={periodCashFlow.savings.actual > 0 ? fmtSigned(periodCashFlow.savings.actual, '−') : '—'} mobileColumn={mobileColumn} />

          {/* Divider */}
          <div className="my-1 hidden sm:grid sm:grid-cols-[1fr_auto_auto] sm:gap-x-4">
            <div />
            <div className="w-28 border-t border-border" />
            <div className="w-28 border-t border-border" />
          </div>
          <div className="my-1 grid grid-cols-[1fr_auto] gap-x-4 sm:hidden">
            <div />
            <div className="w-28 border-t border-border" />
          </div>

          <TwoColRow
            label="End of month"
            left={plannedEnd !== null ? formatCents(plannedEnd) : '—'}
            right={actualEnd !== null ? formatCents(actualEnd) : '—'}
            leftColor={plannedEnd !== null ? (plannedEnd >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400') : undefined}
            rightColor={actualEnd !== null ? (actualEnd >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400') : undefined}
            mobileColumn={mobileColumn}
            isBold
          />

          {!hasAnchor && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Set initial cash balance in{' '}
              <Link to="/settings" className="underline">Settings</Link>
            </p>
          )}
        </div>
      </div>
    );
  }

  // --- Current / Future period: single-column equation ---
  const income = periodCashFlow.income.expected;
  const fixed = periodCashFlow.expenses.expected;
  const variable = periodCashFlow.budgeted.expected;
  const savings = periodCashFlow.savings.expected;
  const plannedEnd = hasAnchor
    ? (startingBalance as number) + income - fixed - variable - savings
    : null;

  // Current pace projection (current period only)
  const projectedVariable = isCurrentPeriod ? periodCashFlow.projection.projectedVariable : null;
  const paceEnd = isCurrentPeriod && hasAnchor
    ? (startingBalance as number) + income - fixed - (projectedVariable ?? variable) - savings
    : null;
  const pacesDiffer = projectedVariable !== null && Math.abs(projectedVariable - variable) >= 100; // at least $1 difference

  return (
    <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
      <LedgerHeader periodLabel={periodLabel} isCurrentPeriod={isCurrentPeriod} isPastPeriod={false} />

      <div className="mt-4">
        {/* Starting cash */}
        <SingleRow label="Starting cash" value={hasAnchor ? formatCents(startingBalance as number) : '—'} />

        {/* + Income */}
        <SingleRow
          label="+ Income"
          value={fmtSigned(income, '+')}
          delta={renderDelta(incomeDelta)}
          annotation={isCurrentPeriod ? `${formatCents(periodCashFlow.income.actual)} received` : undefined}
          className="text-green-600 dark:text-green-400"
        />

        {/* − Fixed expenses */}
        <SingleRow
          label="− Fixed expenses"
          value={fixed > 0 ? fmtSigned(fixed, '−') : '—'}
          delta={renderDelta(-fixedDelta)}
          annotation={isCurrentPeriod ? `${formatCents(periodCashFlow.expenses.dueToDate)} due` : undefined}
        />

        {/* − Variable spending */}
        <SingleRow
          label="− Variable spending"
          value={variable > 0 ? fmtSigned(variable, '−') : '—'}
          delta={renderDelta(-variableDelta)}
          annotation={isCurrentPeriod ? `${formatCents(periodCashFlow.projection.variableActual)} spent` : undefined}
        />

        {/* − Savings */}
        <SingleRow
          label="− Savings"
          value={savings > 0 ? fmtSigned(savings, '−') : '—'}
          delta={renderDelta(-savingsDelta)}
          annotation={isCurrentPeriod ? `${formatCents(periodCashFlow.savings.actual)} saved` : undefined}
        />

        {/* Divider */}
        <div className="my-1 grid grid-cols-[1fr_auto] gap-x-4">
          <div />
          <div className="w-28 border-t border-border" />
        </div>

        {/* End of month — plan */}
        <SingleRow
          label={pacesDiffer ? 'End of month (plan)' : 'End of month'}
          value={plannedEnd !== null ? formatCents(plannedEnd) : '—'}
          delta={renderDelta(endDelta)}
          valueColor={plannedEnd !== null ? (plannedEnd >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400') : undefined}
          isBold
        />

        {/* End of month — at current pace (only when meaningfully different) */}
        {pacesDiffer && (
          <SingleRow
            label="End of month (at pace)"
            value={paceEnd !== null ? formatCents(paceEnd) : '—'}
            valueColor={paceEnd !== null ? (paceEnd >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400') : undefined}
            isBold
          />
        )}

        {/* "Currently $X" */}
        {isCurrentPeriod && cashSurplusData.currentBalance !== null && hasAnchor && (
          <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-4">
            <div />
            <div className="w-28 text-right text-xs text-muted-foreground">
              Currently {formatCents(cashSurplusData.currentBalance)}
            </div>
          </div>
        )}

        {/* No anchor: settings link */}
        {!hasAnchor && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Set initial cash balance in{' '}
            <Link to="/settings" className="underline">Settings</Link>
          </p>
        )}
      </div>
    </div>
  );
}

// --- Shared sub-components ---

function LedgerHeader({ periodLabel, isCurrentPeriod, isPastPeriod }: { periodLabel: string; isCurrentPeriod: boolean; isPastPeriod: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-sm font-medium text-muted-foreground">{periodLabel}</p>
      {isCurrentPeriod && (
        <span className="flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
          <Sparkles className="h-3 w-3" />
          Projected
        </span>
      )}
      {isPastPeriod && (
        <span className="flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">
          <History className="h-3 w-3" />
          Historical
        </span>
      )}
    </div>
  );
}

/** Single-column ledger row (current + future periods) */
function SingleRow({
  label,
  value,
  delta,
  annotation,
  valueColor,
  className,
  isBold = false,
}: {
  label: string;
  value: string;
  delta?: React.ReactNode;
  annotation?: string | undefined;
  valueColor?: string | undefined;
  className?: string;
  isBold?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-0.5">
      <span className={cn('text-sm text-muted-foreground', isBold && 'font-semibold text-foreground')}>
        {label}
        {delta}
      </span>
      <span className={cn('w-28 text-right font-mono text-sm tabular-nums', isBold && 'font-semibold', className, valueColor)}>
        {value}
      </span>
      <span className="w-24 text-right text-xs text-muted-foreground self-center sm:w-28">
        {annotation ?? ''}
      </span>
    </div>
  );
}

/** Two-column ledger row (past period: Planned vs Actual) */
function TwoColRow({
  label,
  left,
  right,
  leftColor,
  rightColor,
  className,
  mobileColumn,
  isBold = false,
}: {
  label: string;
  left: string;
  right: string;
  leftColor?: string | undefined;
  rightColor?: string | undefined;
  className?: string;
  mobileColumn: 'left' | 'right';
  isBold?: boolean;
}) {
  const valCls = cn('w-28 text-right font-mono text-sm tabular-nums', isBold && 'font-semibold', className);
  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto] sm:gap-x-4 sm:py-0.5">
        <span className={cn('text-sm text-muted-foreground', isBold && 'font-semibold text-foreground')}>{label}</span>
        <span className={cn(valCls, leftColor)}>{left}</span>
        <span className={cn(valCls, rightColor)}>{right}</span>
      </div>
      {/* Mobile */}
      <div className="grid grid-cols-[1fr_auto] gap-x-4 py-0.5 sm:hidden">
        <span className={cn('text-sm text-muted-foreground', isBold && 'font-semibold text-foreground')}>{label}</span>
        <span className={cn(valCls, mobileColumn === 'left' ? leftColor : rightColor)}>
          {mobileColumn === 'left' ? left : right}
        </span>
      </div>
    </>
  );
}
