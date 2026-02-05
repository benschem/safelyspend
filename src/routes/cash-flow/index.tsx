import { useState, useMemo, useCallback } from 'react';
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
  Wallet,
  ClipboardCheck,
  X,
} from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { useScenarioDiff } from '@/hooks/use-scenario-diff';
import { useAppConfig } from '@/hooks/use-app-config';

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
import { STORAGE_KEYS } from '@/lib/storage-keys';
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
            <div className="page-title-icon bg-slate-500/10">
              <Banknote className="h-5 w-5 text-slate-500" />
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
            <div className="page-title-icon bg-slate-500/10">
              <Banknote className="h-5 w-5 text-slate-500" />
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

function CheckInNudge() {
  const { checkInCadence, isDemo } = useAppConfig();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEYS.CHECKIN_NUDGE_DISMISSED) === '1',
  );

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.CHECKIN_NUDGE_DISMISSED, '1');
    setDismissed(true);
  }, []);

  // Don't show in demo, if cadence already set, or if dismissed
  if (isDemo || checkInCadence || dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <ClipboardCheck className="h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1 text-sm">
        <span className="font-medium">Set up periodic check-ins</span>
        <span className="text-muted-foreground">
          {' '}to keep your balances accurate.
        </span>
      </div>
      <Link to="/check-in">
        <Button size="sm" variant="outline">
          Get started
        </Button>
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
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
  const [spendingView, setSpendingView] = useState<'budget' | 'income'>('budget');

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

  // --- Lifted computed values (shared between Summary + Breakdown) ---

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

  // Expected amounts
  const income = periodCashFlow.income.expected;
  const fixed = periodCashFlow.expenses.expected;
  const variable = periodCashFlow.budgeted.expected;
  const savingsExpected = periodCashFlow.savings.expected;

  // Planned end of month (absolute)
  const plannedEnd = hasAnchor
    ? (startingBalance as number) + income - fixed - variable - savingsExpected
    : null;

  // Net change (the pure delta, no starting balance)
  const netChange = income - fixed - variable - savingsExpected;

  // Current pace projection (current period only)
  const projectedVariable = isCurrentPeriod ? periodCashFlow.projection.projectedVariable : null;
  const paceEnd = isCurrentPeriod && hasAnchor
    ? (startingBalance as number) + income - fixed - (projectedVariable ?? variable) - savingsExpected
    : null;
  const pacesDiffer = projectedVariable !== null && Math.abs(projectedVariable - variable) >= 100;

  // Past period specifics
  const pastActualEnd = isPastPeriod ? cashSurplusData.cashSurplus : null;
  const pastActualFixed = isPastPeriod
    ? Math.max(0, periodCashFlow.expenses.actual - periodCashFlow.projection.variableActual)
    : 0;
  const pastActualNetChange = isPastPeriod
    ? periodCashFlow.income.actual - pastActualFixed - periodCashFlow.projection.variableActual - periodCashFlow.savings.actual
    : 0;

  // Scenario deltas (per-row)
  const incomeDelta = showDeltas ? periodCashFlow.income.expected - defaultTotals.income : 0;
  const fixedDelta = showDeltas ? periodCashFlow.expenses.expected - defaultTotals.fixedExpenses : 0;
  const variableDelta = showDeltas ? periodCashFlow.budgeted.expected - defaultTotals.budgetedExpenses : 0;
  const savingsDelta = showDeltas ? periodCashFlow.savings.expected - defaultTotals.savings : 0;
  const endDelta = showDeltas ? incomeDelta - fixedDelta - variableDelta - savingsDelta : 0;

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
            <div className="page-title-icon bg-slate-500/10">
              <Banknote className="h-5 w-5 text-slate-500" />
            </div>
            Cash Flow
          </h1>
          <p className="page-description">Track your spending against your plan</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToCurrent}
            className={cn('text-xs', isCurrentPeriod && 'invisible')}
          >
            ← Today
          </Button>
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
        </div>
      </div>

      {/* Check-in nudge */}
      <CheckInNudge />

      {/* Summary + Breakdown side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CashFlowSummary
          periodLabel={periodLabel}
          isCurrentPeriod={isCurrentPeriod}
          isPastPeriod={isPastPeriod}
          isFuturePeriod={isFuturePeriod}
          hasAnchor={hasAnchor}
          plannedEnd={plannedEnd}
          paceEnd={paceEnd}
          pacesDiffer={pacesDiffer}
          currentBalance={cashSurplusData.currentBalance}
          pastActualEnd={pastActualEnd}
          endDelta={endDelta}
          showDeltas={showDeltas}
        />

        <CashFlowBreakdown
          periodLabel={periodLabel}
          isCurrentPeriod={isCurrentPeriod}
          isPastPeriod={isPastPeriod}
          hasAnchor={hasAnchor}
          startingBalance={startingBalance}
          periodCashFlow={periodCashFlow}
          netChange={netChange}
          pastActualFixed={pastActualFixed}
          pastActualNetChange={pastActualNetChange}
          showDeltas={showDeltas}
          incomeDelta={incomeDelta}
          fixedDelta={fixedDelta}
          variableDelta={variableDelta}
          savingsDelta={savingsDelta}
          endDelta={endDelta}
        />
      </div>

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
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BanknoteArrowDown className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">
              Spending over {periodLabel}
              {isCurrentPeriod && ' to date'}
            </h3>
          </div>
          {income > 0 && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setSpendingView('budget')}
                className={cn(
                  'cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  spendingView === 'budget'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                Budget
              </button>
              <button
                type="button"
                onClick={() => setSpendingView('income')}
                className={cn(
                  'cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  spendingView === 'income'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                Income
              </button>
            </div>
          )}
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
                const fixedIncomeView = spendingView === 'income' && income > 0;
                const fixedPercentOfIncome = fixedIncomeView ? Math.round((item.fixedAmount / income) * 100) : 0;
                const fixedSpentPercentOfIncome = fixedIncomeView ? Math.round((item.spent / income) * 100) : 0;
                const fixedBudgetPercent = item.fixedAmount > 0 ? Math.round((item.spent / item.fixedAmount) * 100) : 0;

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
                        <span className="text-xs text-muted-foreground">
                          Budgeted {formatCents(item.fixedAmount)}
                        </span>
                      </div>
                      <span className="font-mono text-muted-foreground">
                        {fixedIncomeView
                          ? <>Spent {formatCents(item.spent)} ({fixedSpentPercentOfIncome}% of income)</>
                          : <>Spent {formatCents(item.spent)} ({fixedBudgetPercent}% of budget)</>
                        }
                      </span>
                    </div>
                    {fixedIncomeView ? (
                      <div className="relative h-2 rounded-full bg-muted">
                        {/* Budget allocation (lighter) */}
                        <div
                          className="absolute h-2 rounded-full"
                          style={{
                            width: `${Math.min(fixedPercentOfIncome, 100)}%`,
                            backgroundColor: item.color,
                            opacity: 0.3,
                          }}
                        />
                        {/* Actual spending (full color) */}
                        <div
                          className="absolute h-2 rounded-full"
                          style={{
                            width: `${Math.min(fixedSpentPercentOfIncome, 100)}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    ) : (
                      <div className="relative h-2 rounded-full bg-muted">
                        <div
                          className="absolute h-2 rounded-full bg-green-500"
                          style={{ width: '100%' }}
                        />
                      </div>
                    )}
                  </Link>
                );
              }

              // Variable categories show progress bar
              const hasBudget = item.budget > 0;
              const isIncomeView = spendingView === 'income' && income > 0;
              const isOverBudget = !isIncomeView && hasBudget && item.spent > item.budget;
              const percentage = hasBudget ? Math.round((item.spent / item.budget) * 100) : 0;
              const isWarning = !isIncomeView && percentage >= 80 && percentage < 100;
              const spentPercentOfIncome = isIncomeView ? Math.round((item.spent / income) * 100) : 0;
              const budgetPercentOfIncome = isIncomeView && hasBudget ? Math.round((item.budget / income) * 100) : 0;

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
                      {hasBudget && (
                        <span className="text-xs text-muted-foreground">
                          Budgeted {formatCents(item.budget)}
                          {(() => {
                            const defaultBudget = defaultBudgetByCategoryMonthly[item.id] ?? 0;
                            const currentBudget = variableBudgetsPerCategory[item.id] ?? 0;
                            const delta = currentBudget - defaultBudget;
                            if (!showDeltas || delta === 0) return null;
                            return (
                              <span className="ml-1 text-violet-600 dark:text-violet-400">
                                ({delta > 0 ? '+' : ''}{formatCents(delta)})
                              </span>
                            );
                          })()}
                        </span>
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
                      {isIncomeView ? (
                        <>Spent {formatCents(item.spent)} ({spentPercentOfIncome}% of income)</>
                      ) : hasBudget ? (
                        <>Spent {formatCents(item.spent)} ({percentage}% of budget)</>
                      ) : (
                        <>Spent {formatCents(item.spent)}</>
                      )}
                    </span>
                  </div>
                  {isIncomeView ? (
                    <div className="relative h-2 rounded-full bg-muted">
                      {/* Budget allocation (lighter) */}
                      {hasBudget && (
                        <div
                          className="absolute h-2 rounded-full"
                          style={{
                            width: `${Math.min(budgetPercentOfIncome, 100)}%`,
                            backgroundColor: item.color,
                            opacity: 0.3,
                          }}
                        />
                      )}
                      {/* Actual spending (full color) */}
                      <div
                        className="absolute h-2 rounded-full"
                        style={{
                          width: `${Math.min(spentPercentOfIncome, 100)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  ) : (
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
                  )}
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
                  const savingsIncomeView = spendingView === 'income' && income > 0;
                  const savingsActualPercentOfIncome = savingsIncomeView ? Math.round((goal.actual / income) * 100) : 0;
                  const savingsExpectedPercentOfIncome = savingsIncomeView && hasExpected ? Math.round((goal.expected / income) * 100) : 0;

                  return (
                    <div key={goal.id} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
                        <div className="flex items-center gap-2">
                          <PiggyBank className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{goal.name}</span>
                          {hasExpected && (
                            <span className="text-xs text-muted-foreground">
                              Planned {formatCents(goal.expected)}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-muted-foreground">
                          {savingsIncomeView ? (
                            <>Saved {formatCents(goal.actual)} ({savingsActualPercentOfIncome}% of income)</>
                          ) : hasExpected ? (
                            <>Saved {formatCents(goal.actual)} ({percentage}% of planned)</>
                          ) : (
                            <>Saved {formatCents(goal.actual)}</>
                          )}
                        </span>
                      </div>
                      {savingsIncomeView ? (
                        <div className="relative h-2 rounded-full bg-muted">
                          {/* Expected allocation (lighter) */}
                          {hasExpected && (
                            <div
                              className="absolute h-2 rounded-full bg-blue-500"
                              style={{
                                width: `${Math.min(savingsExpectedPercentOfIncome, 100)}%`,
                                opacity: 0.3,
                              }}
                            />
                          )}
                          {/* Actual savings (full color) */}
                          <div
                            className="absolute h-2 rounded-full bg-blue-500"
                            style={{ width: `${Math.min(savingsActualPercentOfIncome, 100)}%` }}
                          />
                        </div>
                      ) : hasExpected ? (
                        <div className="relative h-2 rounded-full bg-muted">
                          <div
                            className="absolute h-2 rounded-full bg-blue-500"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      ) : null}
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

// --- Cash Flow Summary (Hero Card) ---

interface CashFlowSummaryProps {
  periodLabel: string;
  isCurrentPeriod: boolean;
  isPastPeriod: boolean;
  isFuturePeriod: boolean;
  hasAnchor: boolean;
  plannedEnd: number | null;
  paceEnd: number | null;
  pacesDiffer: boolean;
  currentBalance: number | null;
  pastActualEnd: number | null;
  endDelta: number;
  showDeltas: boolean;
}

function CashFlowSummary({
  periodLabel,
  isCurrentPeriod,
  isPastPeriod,
  isFuturePeriod,
  hasAnchor,
  plannedEnd,
  paceEnd,
  pacesDiffer,
  currentBalance,
  pastActualEnd,
  endDelta,
  showDeltas,
}: CashFlowSummaryProps) {
  const colorForAmount = (amount: number) =>
    amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';

  // No anchor: show CTA
  if (!hasAnchor) {
    return (
      <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
        <SummaryHeader periodLabel={periodLabel} isCurrentPeriod={isCurrentPeriod} isPastPeriod={isPastPeriod} />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Set initial cash balance in{' '}
          <Link to="/settings" className="underline">Settings</Link>{' '}
          to see your projected end-of-month balance.
        </p>
      </div>
    );
  }

  // --- Past period: 2 metrics ---
  if (isPastPeriod) {
    const diff = pastActualEnd !== null && plannedEnd !== null ? pastActualEnd - plannedEnd : null;
    return (
      <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
        <SummaryHeader periodLabel={periodLabel} isCurrentPeriod={false} isPastPeriod />
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <div>
            <SummaryMetric label="Planned end" value={plannedEnd !== null ? formatCents(plannedEnd) : '—'} color={plannedEnd !== null ? colorForAmount(plannedEnd) : undefined} />
            <p className="invisible mt-1 text-xs">&nbsp;</p>
          </div>
          <div>
            <SummaryMetric label="Actual end" value={pastActualEnd !== null ? formatCents(pastActualEnd) : '—'} color={pastActualEnd !== null ? colorForAmount(pastActualEnd) : undefined} align="right" />
            <p className="invisible mt-1 text-xs">&nbsp;</p>
          </div>
        </div>
        {diff !== null && Math.abs(diff) >= 100 && (
          <div className={cn('mt-4 rounded-lg bg-muted px-3 py-2 text-center text-sm', diff > 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>
            {diff > 0 ? `Ended ${formatCents(diff)} ahead of plan` : `Spent ${formatCents(Math.abs(diff))} more than planned`}
          </div>
        )}
        {/* Invisible spacer matching current period's "Cash balance right now" section */}
        <div className="invisible mt-4 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">&nbsp;</span>
            <span className="text-lg font-semibold">&nbsp;</span>
          </div>
        </div>
      </div>
    );
  }

  // --- Future period: single centered metric ---
  if (isFuturePeriod) {
    return (
      <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
        <SummaryHeader periodLabel={periodLabel} isCurrentPeriod={false} isPastPeriod={false} />
        <div className="mt-5 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">End of month</p>
          <p className={cn('mt-1 text-4xl font-bold tracking-tight tabular-nums', plannedEnd !== null ? colorForAmount(plannedEnd) : '')}>
            {plannedEnd !== null ? formatCents(plannedEnd) : '—'}
          </p>
          <p className={cn('mt-1 text-xs', showDeltas && endDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : 'invisible')}>
            {showDeltas && endDelta !== 0 ? `(${endDelta > 0 ? '+' : ''}${formatCents(endDelta)} vs default)` : '\u00A0'}
          </p>
        </div>
      </div>
    );
  }

  // --- Current period: projected metrics + separated "right now" ---
  const showPace = pacesDiffer && paceEnd !== null;
  const diff = showPace && plannedEnd !== null ? plannedEnd - paceEnd : null;

  return (
    <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
      <SummaryHeader periodLabel={periodLabel} isCurrentPeriod isPastPeriod={false} />
      {/* Projected metrics */}
      <div className={cn('mt-5 grid gap-6', showPace ? 'sm:grid-cols-2' : 'sm:grid-cols-1')}>
        <div>
          <SummaryMetric
            label={showPace ? 'End of month (plan)' : 'End of month'}
            value={plannedEnd !== null ? formatCents(plannedEnd) : '—'}
            color={plannedEnd !== null ? colorForAmount(plannedEnd) : undefined}
          />
          <p className={cn('mt-1 text-xs', showDeltas && endDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : 'invisible')}>
            {showDeltas && endDelta !== 0 ? `(${endDelta > 0 ? '+' : ''}${formatCents(endDelta)} vs default)` : '\u00A0'}
          </p>
        </div>
        {showPace && (
          <SummaryMetric label="At current pace" value={formatCents(paceEnd)} color={colorForAmount(paceEnd)} align="right" />
        )}
      </div>
      {diff !== null && Math.abs(diff) >= 100 && (
        <div className={cn('mt-4 rounded-lg bg-muted px-3 py-2 text-center text-sm', diff > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400')}>
          {diff > 0 ? `Spending ${formatCents(diff)} faster than planned` : `Spending ${formatCents(Math.abs(diff))} less than planned`}
        </div>
      )}
      {/* Current balance — separated from projections */}
      {currentBalance !== null && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Cash balance right now</span>
            <span className="text-lg font-semibold tabular-nums">{formatCents(currentBalance)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryMetric({ label, value, color, align = 'left' }: { label: string; value: string; color?: string | undefined; align?: 'left' | 'right' }) {
  return (
    <div className={cn('text-center', align === 'right' ? 'sm:text-right' : 'sm:text-left')}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-3xl font-bold tracking-tight tabular-nums', color)}>
        {value}
      </p>
    </div>
  );
}

// --- Cash Flow Breakdown Card ---

interface CashFlowBreakdownProps {
  periodLabel: string;
  isCurrentPeriod: boolean;
  isPastPeriod: boolean;
  hasAnchor: boolean;
  startingBalance: number | null;
  periodCashFlow: {
    income: { expected: number; actual: number };
    budgeted: { expected: number; actual: number };
    savings: { expected: number; actual: number };
    expenses: { expected: number; actual: number; dueToDate: number };
    projection: { variableActual: number; projectedVariable: number; projectedTotal: number };
  };
  netChange: number;
  pastActualFixed: number;
  pastActualNetChange: number;
  showDeltas: boolean;
  incomeDelta: number;
  fixedDelta: number;
  variableDelta: number;
  savingsDelta: number;
  endDelta: number;
}

function CashFlowBreakdown({
  isCurrentPeriod,
  isPastPeriod,
  hasAnchor,
  startingBalance,
  periodCashFlow,
  netChange,
  pastActualFixed,
  pastActualNetChange,
  showDeltas,
  incomeDelta,
  fixedDelta,
  variableDelta,
  savingsDelta,
  endDelta,
}: CashFlowBreakdownProps) {
  const [mobileColumn, setMobileColumn] = useState<'left' | 'right'>('left');

  const renderDelta = (delta: number) => {
    if (!showDeltas || delta === 0) return null;
    return (
      <span className="ml-1.5 text-xs text-violet-600 dark:text-violet-400">
        ({delta > 0 ? '+' : ''}{formatCents(delta)})
      </span>
    );
  };

  const fmtSigned = (amount: number, prefix: string) => `${prefix}${formatCents(Math.abs(amount))}`;

  const income = periodCashFlow.income.expected;
  const fixed = periodCashFlow.expenses.expected;
  const variable = periodCashFlow.budgeted.expected;
  const savings = periodCashFlow.savings.expected;

  // --- Past period: two-column breakdown ---
  if (isPastPeriod) {
    return (
      <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Monthly Breakdown</h3>
        </div>

        {/* Mobile tabs */}
        <div className="mt-4 flex gap-1 sm:hidden">
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

          <TwoColRow label="Starting cash" left={hasAnchor ? formatCents(startingBalance as number) : '—'} right={hasAnchor ? formatCents(startingBalance as number) : '—'} leftHref="/settings" mobileColumn={mobileColumn} />
          <TwoColRow label="+ Income" left={fmtSigned(income, '+')} right={fmtSigned(periodCashFlow.income.actual, '+')} leftHref="/budget?section=income" mobileColumn={mobileColumn} className="text-green-600 dark:text-green-400" />
          <TwoColRow label="− Fixed expenses" left={fixed > 0 ? fmtSigned(fixed, '−') : '—'} right={pastActualFixed > 0 ? fmtSigned(pastActualFixed, '−') : '—'} leftHref="/budget?section=fixed" mobileColumn={mobileColumn} />
          <TwoColRow label="− Variable spending" left={variable > 0 ? fmtSigned(variable, '−') : '—'} right={periodCashFlow.projection.variableActual > 0 ? fmtSigned(periodCashFlow.projection.variableActual, '−') : '—'} leftHref="/budget?section=variable" mobileColumn={mobileColumn} />
          <TwoColRow label="− Savings" left={savings > 0 ? fmtSigned(savings, '−') : '—'} right={periodCashFlow.savings.actual > 0 ? fmtSigned(periodCashFlow.savings.actual, '−') : '—'} leftHref="/budget?section=savings" mobileColumn={mobileColumn} />

          {/* Divider */}
          <div className="my-2 border-t border-border" />

          <TwoColRow
            label="Net change"
            left={fmtSigned(netChange, netChange >= 0 ? '+' : '−')}
            right={fmtSigned(pastActualNetChange, pastActualNetChange >= 0 ? '+' : '−')}
            leftColor={netChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}
            rightColor={pastActualNetChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}
            mobileColumn={mobileColumn}
            isBold
          />
        </div>
      </div>
    );
  }

  // --- Current / Future period: single-column breakdown ---
  return (
    <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Monthly Breakdown</h3>
      </div>

      <div className="mt-4">
        {isCurrentPeriod && (
          <div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-x-4">
            <div />
            <div className="w-28 text-right text-xs font-medium text-muted-foreground">Planned</div>
            <div className="w-24 text-right text-xs font-medium text-muted-foreground sm:w-28">Current</div>
          </div>
        )}
        <SingleRow label="Starting cash" value={hasAnchor ? formatCents(startingBalance as number) : '—'} href="/settings" />

        <SingleRow
          label="+ Income"
          value={fmtSigned(income, '+')}
          delta={renderDelta(incomeDelta)}
          annotation={isCurrentPeriod ? `${formatCents(periodCashFlow.income.actual)} received` : undefined}
          className="text-green-600 dark:text-green-400"
          href="/budget?section=income"
        />

        <SingleRow
          label="− Fixed expenses"
          value={fixed > 0 ? fmtSigned(fixed, '−') : '—'}
          delta={renderDelta(-fixedDelta)}
          annotation={isCurrentPeriod ? `${formatCents(periodCashFlow.expenses.dueToDate)} due` : undefined}
          href="/budget?section=fixed"
        />

        <SingleRow
          label="− Variable spending"
          value={variable > 0 ? fmtSigned(variable, '−') : '—'}
          delta={renderDelta(-variableDelta)}
          annotation={isCurrentPeriod ? `${formatCents(periodCashFlow.projection.variableActual)} spent` : undefined}
          href="/budget?section=variable"
        />

        <SingleRow
          label="− Savings"
          value={savings > 0 ? fmtSigned(savings, '−') : '—'}
          delta={renderDelta(-savingsDelta)}
          annotation={isCurrentPeriod ? `${formatCents(periodCashFlow.savings.actual)} saved` : undefined}
          href="/budget?section=savings"
        />

        {/* Divider */}
        <div className="my-2 border-t border-border" />

        <SingleRow
          label="Net change"
          value={fmtSigned(netChange, netChange >= 0 ? '+' : '−')}
          delta={renderDelta(endDelta)}
          valueColor={netChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}
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

// --- Shared sub-components ---

function SummaryHeader({ periodLabel, isCurrentPeriod, isPastPeriod }: { periodLabel: string; isCurrentPeriod: boolean; isPastPeriod: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Banknote className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">{periodLabel}</h3>
      </div>
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
  href,
  isBold = false,
}: {
  label: string;
  value: string;
  delta?: React.ReactNode;
  annotation?: string | undefined;
  valueColor?: string | undefined;
  className?: string;
  href?: string;
  isBold?: boolean;
}) {
  const valContent = href ? (
    <Link to={href} className={cn('w-28 text-right font-mono text-sm tabular-nums hover:underline', isBold && 'font-semibold', className, valueColor)}>
      {value}
    </Link>
  ) : (
    <span className={cn('w-28 text-right font-mono text-sm tabular-nums', isBold && 'font-semibold', className, valueColor)}>
      {value}
    </span>
  );

  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-0.5">
      <span className={cn('text-sm text-muted-foreground', isBold && 'font-semibold text-foreground')}>
        {label}
        {delta}
      </span>
      {valContent}
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
  leftHref,
  mobileColumn,
  isBold = false,
}: {
  label: string;
  left: string;
  right: string;
  leftColor?: string | undefined;
  rightColor?: string | undefined;
  className?: string;
  leftHref?: string;
  mobileColumn: 'left' | 'right';
  isBold?: boolean;
}) {
  const valCls = cn('w-28 text-right font-mono text-sm tabular-nums', isBold && 'font-semibold', className);

  const leftContent = leftHref ? (
    <Link to={leftHref} className={cn(valCls, leftColor, 'hover:underline')}>{left}</Link>
  ) : (
    <span className={cn(valCls, leftColor)}>{left}</span>
  );

  const rightContent = <span className={cn(valCls, rightColor)}>{right}</span>;

  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto] sm:gap-x-4 sm:py-0.5">
        <span className={cn('text-sm text-muted-foreground', isBold && 'font-semibold text-foreground')}>{label}</span>
        {leftContent}
        {rightContent}
      </div>
      {/* Mobile */}
      <div className="grid grid-cols-[1fr_auto] gap-x-4 py-0.5 sm:hidden">
        <span className={cn('text-sm text-muted-foreground', isBold && 'font-semibold text-foreground')}>{label}</span>
        {mobileColumn === 'left' ? (
          leftHref ? (
            <Link to={leftHref} className={cn(valCls, leftColor, 'hover:underline')}>{left}</Link>
          ) : (
            <span className={cn(valCls, leftColor)}>{left}</span>
          )
        ) : (
          <span className={cn(valCls, rightColor)}>{right}</span>
        )}
      </div>
    </>
  );
}
