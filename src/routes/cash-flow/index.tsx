import { useState, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  PiggyBank,
  Banknote,
  BanknoteArrowUp,
  BanknoteArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  History,

  Pin,
  Tag,
  CircleDot,
  CircleGauge,
} from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { useScenarioDiff } from '@/hooks/use-scenario-diff';

import { useForecasts } from '@/hooks/use-forecasts';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useCategories } from '@/hooks/use-categories';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useTransactions } from '@/hooks/use-transactions';

import { useBudgetPeriodData } from '@/hooks/use-budget-period-data';
import { ScenarioDelta } from '@/components/ui/scenario-delta';
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

      <CashFlowContent activeScenarioId={activeScenarioId} />
    </div>
  );
}

interface CashFlowContentProps {
  activeScenarioId: string;
}

function CashFlowContent({ activeScenarioId }: CashFlowContentProps) {
  const { activeScenario } = useScenarios();
  const { getTotalDelta, isViewingDefault, defaultBudgetByCategoryMonthly } = useScenarioDiff();
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

  const incomeSourceCount = useMemo(
    () => forecastRules.filter((r) => r.type === 'income').length,
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

  // Calculate headline metric
  const headline = useMemo(() => {
    const hasPlan =
      periodCashFlow.income.expected > 0 ||
      periodCashFlow.budgeted.expected > 0 ||
      periodCashFlow.expenses.expected > 0;
    // Match Budget page: income - fixed expenses - variable budget - savings
    const planned =
      periodCashFlow.income.expected -
      periodCashFlow.expenses.expected - // fixed expenses (ForecastRules)
      periodCashFlow.budgeted.expected - // variable budget (BudgetRules)
      periodCashFlow.savings.expected;

    if (isPastPeriod) {
      const leftover =
        periodCashFlow.income.actual -
        periodCashFlow.expenses.actual -
        periodCashFlow.savings.actual;
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
        label:
          planned > 0 ? 'Expected surplus' : planned < 0 ? 'Expected shortfall' : 'Budget balanced',
        isPositive: planned >= 0,
        hasPlan,
      };
    }

    // Current period - use same calculation as Budget page for consistency
    if (!hasPlan) {
      const actualSoFar =
        periodCashFlow.income.actual -
        periodCashFlow.expenses.actual -
        periodCashFlow.savings.actual;
      return {
        amount: actualSoFar,
        label: 'No plan set',
        isPositive: actualSoFar >= 0,
        hasPlan: false,
      };
    }

    return {
      amount: planned,
      label:
        planned > 0 ? 'Expected surplus' : planned < 0 ? 'Expected shortfall' : 'Budget balanced',
      isPositive: planned >= 0,
      hasPlan,
    };
  }, [isPastPeriod, isFuturePeriod, periodCashFlow]);

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

    // Descriptive message based on burn rate
    if (burnRate > 120) {
      const bufferNote = hasSurplusBuffer ? ' You have surplus buffer.' : ' Consider slowing down.';
      return {
        amount: 0,
        label: `Spending faster than your budget allows.${bufferNote}`,
        isPositive: false,
        hasBudget: true,
      };
    } else if (burnRate > 100) {
      return {
        amount: 0,
        label: 'Slightly ahead of your budget.',
        isPositive: false,
        hasBudget: true,
      };
    } else {
      return {
        amount: 0,
        label: 'On track with your budget. Keep it up!',
        isPositive: true,
        hasBudget: true,
      };
    }
  }, [isFuturePeriod, isPastPeriod, periodCashFlow, hasSurplusBuffer]);

  // Headline status label for hero
  const heroStatusLabel = useMemo(() => {
    if (!headline.hasPlan && !isPastPeriod) return 'NO PLAN SET';
    if (headline.amount === 0 && headline.isPositive && headline.hasPlan) return 'BUDGET BALANCED';
    if (isPastPeriod) {
      return headline.isPositive ? 'ACTUAL SURPLUS' : 'ACTUAL SHORTFALL';
    }
    return headline.isPositive ? 'PROJECTED SURPLUS' : 'PROJECTED SHORTFALL';
  }, [headline, isPastPeriod]);

  if (isLoading) {
    return null;
  }

  // Whether the selected month is the current month (can't go further forward)
  const now = new Date();
  const isAtCurrentMonth =
    selectedMonth.getFullYear() === now.getFullYear() &&
    selectedMonth.getMonth() === now.getMonth();

  return (
    <div className="space-y-6">
      {/* Period Navigation - top left */}
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
          <PopoverContent className="w-64 p-3" align="start">
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

      {/* Hero Header */}
      <div className="mb-4 min-h-28 text-center sm:min-h-32">
        {/* Status pill */}
        <div className="flex min-h-8 items-center justify-center">
          {isCurrentPeriod && (
            <span className="flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-400">
              <CircleDot className="h-3 w-3" />
              Today
            </span>
          )}
          {isPastPeriod && (
            <span className="flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400">
              <History className="h-3 w-3" />
              Historical
            </span>
          )}
        </div>

        {/* Hero Surplus/Shortfall */}
        <div className="mt-4">
          <p
            className={cn(
              'flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide',
              heroStatusLabel === 'NO PLAN SET'
                ? 'text-muted-foreground'
                : headline.isPositive
                  ? 'text-green-500'
                  : 'text-amber-500',
            )}
          >
            <Banknote className="h-4 w-4" />
            {heroStatusLabel}
          </p>
          {heroStatusLabel === 'BUDGET BALANCED' ? (
            <p className="mt-2 text-5xl font-bold tracking-tight text-green-500">
              Every dollar accounted for
            </p>
          ) : (
            <p
              className={cn(
                'mt-2 text-5xl font-bold tracking-tight',
                heroStatusLabel === 'NO PLAN SET'
                  ? ''
                  : headline.isPositive
                    ? 'text-green-500'
                    : 'text-amber-500',
              )}
            >
              {headline.isPositive && headline.amount > 0 ? '+' : ''}
              {formatCents(headline.amount)}
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{periodLabel}</p>
          <div className="mx-auto mt-4 mb-3 h-px w-24 bg-border" />
          <ScenarioDelta
            delta={getTotalDelta(
              'surplus',
              periodCashFlow.income.expected -
                periodCashFlow.expenses.expected -
                periodCashFlow.budgeted.expected -
                periodCashFlow.savings.expected,
            )}
            show={showDeltas}
          />
        </div>

      </div>

      {/* 4 Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Income Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
              <BanknoteArrowUp className="h-4 w-4 text-green-500" />
            </div>
            <span className="text-sm text-muted-foreground">Income</span>
          </div>
          {isFuturePeriod ? (
            <p className="mt-2 text-2xl font-bold">
              {formatCents(periodCashFlow.income.expected)}
            </p>
          ) : (
            <p className="mt-2 text-2xl font-bold">
              {formatCents(periodCashFlow.income.actual)}
              <span className="ml-1 text-base font-normal text-muted-foreground">
                of {formatCents(periodCashFlow.income.expected)}
              </span>
            </p>
          )}
          {incomeSourceCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {incomeSourceCount} source{incomeSourceCount !== 1 ? 's' : ''}
            </p>
          )}
          <ScenarioDelta
            delta={getTotalDelta('income', periodCashFlow.income.expected)}
            periodLabel=""
            show={showDeltas}
          />
        </div>

        {/* Fixed Expenses Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
              <BanknoteArrowDown className="h-4 w-4 text-red-500" />
            </div>
            <span className="text-sm text-muted-foreground">Fixed Expenses</span>
          </div>
          {isFuturePeriod ? (
            <p className="mt-2 text-2xl font-bold">
              {periodCashFlow.expenses.expected > 0
                ? formatCents(periodCashFlow.expenses.expected)
                : '—'}
            </p>
          ) : (
            <p className="mt-2 text-2xl font-bold">
              {periodCashFlow.expenses.expected > 0 ? (
                <>
                  {formatCents(periodCashFlow.expenses.dueToDate)}
                  <span className="ml-1 text-base font-normal text-muted-foreground">
                    of {formatCents(periodCashFlow.expenses.expected)}
                  </span>
                </>
              ) : (
                '—'
              )}
            </p>
          )}
          {periodCashFlow.income.expected > 0 && periodCashFlow.expenses.expected > 0 && (
            <p className="text-xs text-muted-foreground">
              {Math.round(
                (periodCashFlow.expenses.expected / periodCashFlow.income.expected) * 100,
              )}
              % of income
            </p>
          )}
          <ScenarioDelta
            delta={getTotalDelta('fixed', periodCashFlow.expenses.expected)}
            periodLabel=""
            show={showDeltas}
          />
        </div>

        {/* Budgeted Expenses Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
              <BanknoteArrowDown className="h-4 w-4 text-red-500" />
            </div>
            <span className="text-sm text-muted-foreground">Budgeted Expenses</span>
          </div>
          {isFuturePeriod ? (
            <p className="mt-2 text-2xl font-bold">
              {periodCashFlow.budgeted.expected > 0
                ? formatCents(periodCashFlow.budgeted.expected)
                : '—'}
            </p>
          ) : (
            <p className="mt-2 text-2xl font-bold">
              {formatCents(periodCashFlow.expenses.actual)}
              <span className="ml-1 text-base font-normal text-muted-foreground">
                of {formatCents(periodCashFlow.budgeted.expected)}
              </span>
            </p>
          )}
          {periodCashFlow.income.expected > 0 && periodCashFlow.budgeted.expected > 0 && (
            <p className="text-xs text-muted-foreground">
              {Math.round(
                (periodCashFlow.budgeted.expected / periodCashFlow.income.expected) * 100,
              )}
              % of income
            </p>
          )}
          <ScenarioDelta
            delta={getTotalDelta('budget', periodCashFlow.budgeted.expected)}
            periodLabel=""
            show={showDeltas}
          />
        </div>

        {/* Savings Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10">
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">Savings</span>
          </div>
          {isFuturePeriod ? (
            <p className="mt-2 text-2xl font-bold">
              {formatCents(periodCashFlow.savings.expected)}
            </p>
          ) : (
            <p className="mt-2 text-2xl font-bold">
              {formatCents(periodCashFlow.savings.actual)}
              <span className="ml-1 text-base font-normal text-muted-foreground">
                of {formatCents(periodCashFlow.savings.expected)}
              </span>
            </p>
          )}
          {periodCashFlow.income.expected > 0 && periodCashFlow.savings.expected > 0 && (
            <p className="text-xs text-muted-foreground">
              {Math.round(
                (periodCashFlow.savings.expected / periodCashFlow.income.expected) * 100,
              )}
              % of income
            </p>
          )}
          <ScenarioDelta
            delta={getTotalDelta('savings', periodCashFlow.savings.expected)}
            periodLabel=""
            show={showDeltas}
          />
        </div>
      </div>

      {/* Spending Pace with burn rate chart - full width */}
      {budgetStatus && (
        <div
          className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}
        >
          <div className="mb-3 flex items-center gap-2">
            <CircleGauge className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Spending Pace</h3>
          </div>
          <p
            className={`mb-3 text-xs ${showDeltas ? 'text-violet-600 dark:text-violet-400' : 'invisible'}`}
          >
            {isWhatIfMode && isViewingDefault
              ? 'Based on your adjustments'
              : `Based on "${activeScenario?.name ?? 'scenario'}"`}
          </p>
          {budgetStatus.amount > 0 ? (
            <p
              className={cn(
                'text-xl font-bold',
                budgetStatus.isPositive
                  ? budgetStatus.hasBudget
                    ? 'text-green-600 dark:text-green-400'
                    : ''
                  : 'text-amber-600 dark:text-amber-400',
              )}
            >
              {formatCents(budgetStatus.amount)}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {budgetStatus.label}
              </span>
            </p>
          ) : (
            <p
              className={cn(
                'text-sm',
                budgetStatus.isPositive
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-amber-600 dark:text-amber-400',
              )}
            >
              {budgetStatus.label}
            </p>
          )}
          {/* Burn rate chart - only show for current period */}
          {isCurrentPeriod && budgetStatus.hasBudget && burnRateData.totalBudget > 0 && (
            <div className="mt-4">
              <BurnRateChart
                dailySpending={burnRateData.dailySpending}
                totalBudget={burnRateData.totalBudget}
                periodStart={burnRateData.periodStart}
                periodEnd={burnRateData.periodEnd}
                periodLabel={burnRateData.periodLabel}
                viewMode="month"
                surplusAmount={hasSurplusBuffer ? surplus : undefined}
              />
            </div>
          )}
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
