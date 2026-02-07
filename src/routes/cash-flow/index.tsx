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
  ArrowDownUp,
  Pin,
  Tag,
  Sparkles,
  ClipboardCheck,
  X,
  Clock,
  Target,
  MapPin,
  CircleCheck,
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
import { useSavingsAnchors } from '@/hooks/use-savings-anchors';
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
  const { isViewingDefault, defaultBudgetByCategoryMonthly, defaultTotals, defaultScenarioName } = useScenarioDiff();
  const { isWhatIfMode } = useWhatIf();
  const { budgetRules } = useBudgetRules(activeScenarioId);
  const { categories } = useCategories();
  const { savingsGoals } = useSavingsGoals();
  const { allTransactions } = useTransactions();
  const { getActiveAnchor } = useSavingsAnchors();
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

    // Sort: non-fixed items first, then fixed-only items, then unplanned at bottom
    return result.sort((a, b) => {
      const aUnplanned = a.id === 'uncategorized' ? 1 : 0;
      const bUnplanned = b.id === 'uncategorized' ? 1 : 0;
      if (aUnplanned !== bUnplanned) return aUnplanned - bUnplanned;
      return Number(a.isFixedOnly) - Number(b.isFixedOnly);
    });
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
  // Projected savings: if already saved more than planned, use actual
  const projectedSavings = isCurrentPeriod
    ? Math.max(savingsExpected, periodCashFlow.savings.actual)
    : savingsExpected;
  const paceEnd = isCurrentPeriod && hasAnchor
    ? (startingBalance as number) + income - fixed - (projectedVariable ?? variable) - projectedSavings
    : null;
  // Paces differ when projected variable spending is meaningfully different from planned
  // Use 10% of variable budget as tolerance, with a $50 floor
  const paceTolerance = Math.max(5000, Math.round(variable * 0.1));
  const pacesDiffer = projectedVariable !== null && Math.abs(projectedVariable - variable) >= paceTolerance;

  // Projected net change (uses projectedVariable and projectedSavings)
  const projectedNetChange = projectedVariable !== null
    ? income - fixed - projectedVariable - projectedSavings
    : netChange;

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

  // Total savings balance across all goals (anchor + transactions after anchor)
  const totalSavingsBalance = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let total = 0;
    for (const goal of savingsGoals) {
      const anchor = getActiveAnchor(goal.id, todayStr);
      if (anchor) {
        const txAfter = allTransactions
          .filter((t) => t.type === 'savings' && t.savingsGoalId === goal.id && t.date > anchor.date)
          .reduce((sum, t) => sum + t.amountCents, 0);
        total += anchor.balanceCents + txAfter;
      } else {
        total += allTransactions
          .filter((t) => t.type === 'savings' && t.savingsGoalId === goal.id)
          .reduce((sum, t) => sum + t.amountCents, 0);
      }
    }
    return total;
  }, [savingsGoals, allTransactions, getActiveAnchor]);

  if (isLoading) {
    return null;
  }

  const now = new Date();

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
          <Button variant="ghost" size="icon" onClick={goToPrevious} className="h-9 w-9" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNext}
            className="h-9 w-9"
            aria-label="Next month"
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
                  aria-label="Previous year"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold">{pickerYear}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPickerYear((y) => y + 1)}
                  aria-label="Next year"
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

      {/* Summary cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        <CashBalanceCard
          periodLabel={periodLabel}
          isCurrentPeriod={isCurrentPeriod}
          isPastPeriod={isPastPeriod}
          hasAnchor={hasAnchor}
          startingBalance={startingBalance}
          periodCashFlow={periodCashFlow}
          netChange={netChange}
          actualNetChange={periodCashFlow.income.actual - periodCashFlow.expenses.actual - periodCashFlow.savings.actual}
          pastActualFixed={pastActualFixed}
          pastActualNetChange={pastActualNetChange}
          showDeltas={showDeltas}
          incomeDelta={incomeDelta}
          fixedDelta={fixedDelta}
          variableDelta={variableDelta}
          savingsDelta={savingsDelta}
          endDelta={endDelta}
          pacesDiffer={pacesDiffer}
          projectedVariable={projectedVariable}
          projectedNetChange={projectedNetChange}
          projectedSavings={projectedSavings}
          defaultScenarioName={defaultScenarioName}
          plannedEnd={plannedEnd}
          paceEnd={paceEnd}
          pastActualEnd={pastActualEnd}
        />

        <SavingsGrowthCard
          periodLabel={periodLabel}
          isCurrentPeriod={isCurrentPeriod}
          isPastPeriod={isPastPeriod}
          hasAnchor={hasAnchor}
          startingBalance={startingBalance}
          periodCashFlow={periodCashFlow}
          netChange={netChange}
          actualNetChange={periodCashFlow.income.actual - periodCashFlow.expenses.actual - periodCashFlow.savings.actual}
          pastActualFixed={pastActualFixed}
          pastActualNetChange={pastActualNetChange}
          showDeltas={showDeltas}
          incomeDelta={incomeDelta}
          fixedDelta={fixedDelta}
          variableDelta={variableDelta}
          savingsDelta={savingsDelta}
          endDelta={endDelta}
          pacesDiffer={pacesDiffer}
          projectedVariable={projectedVariable}
          projectedNetChange={projectedNetChange}
          projectedSavings={projectedSavings}
          defaultScenarioName={defaultScenarioName}
          totalSavingsBalance={totalSavingsBalance}
        />
      </div>

      {/* Spending Pace */}
      {isCurrentPeriod && budgetStatus?.hasBudget && burnRateData.totalBudget > 0 && (
        <div className={cn('rounded-xl border bg-card p-6', showDeltas && 'border-violet-500/30')}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10"><BanknoteArrowDown className="h-4 w-4 text-amber-600 dark:text-amber-400" /></span>
              <h3 className="text-lg font-semibold">Spending Pace</h3>
            </div>
            {(() => {
              const isFaster = pacesDiffer && projectedVariable !== null && projectedVariable > variable;
              const isSlower = pacesDiffer && projectedVariable !== null && projectedVariable < variable;
              return (
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  isFaster
                    ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                    : 'bg-green-500/10 text-green-600 dark:text-green-400',
                )}>
                  {isFaster ? 'Faster than planned' : isSlower ? 'Less than planned' : 'On track'}
                </span>
              );
            })()}
          </div>
          <BurnRateChart
            dailySpending={burnRateData.dailySpending}
            totalBudget={burnRateData.totalBudget}
            periodStart={burnRateData.periodStart}
            periodEnd={burnRateData.periodEnd}
            periodLabel={burnRateData.periodLabel}
            viewMode="month"
            income={income}
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
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/10"><BanknoteArrowDown className="h-4 w-4 text-rose-600 dark:text-rose-400" /></span>
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
                        <span className="flex items-center gap-1 rounded bg-orange-500/10 px-1.5 py-0.5 text-xs text-orange-600 dark:text-orange-400">
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
                              <span className="flex items-center gap-1 rounded bg-orange-500/10 px-1.5 py-0.5 text-xs text-orange-600 dark:text-orange-400">
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
                            ? 'text-orange-600 dark:text-orange-400'
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
                          isOverBudget ? 'bg-red-500' : isWarning ? 'bg-orange-500' : '',
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

// --- Cash Balance Card (combined End of Month + Cash Change) ---

function CashBalanceCard(props: CashBalanceCardProps) {
  const {
    isCurrentPeriod,
    isPastPeriod,
    hasAnchor,
    startingBalance,
    netChange,
    actualNetChange,
    pastActualNetChange,
    showDeltas,
    endDelta,
    pacesDiffer,
    projectedNetChange,
    plannedEnd,
    paceEnd,
    pastActualEnd,
  } = props;

  const [flipped, setFlipped] = useState(false);

  const fmtChange = (amount: number) => {
    const sign = amount >= 0 ? '+' : '−';
    return `${sign}${formatCents(Math.abs(amount))}`;
  };

  const fmtBalance = (amount: number) => {
    if (amount < 0) return `−${formatCents(Math.abs(amount))}`;
    return formatCents(amount);
  };

  const colorForChange = (amount: number) =>
    amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';

  const flipButton = (
    <button
      type="button"
      onClick={() => setFlipped(!flipped)}
      className="ml-auto cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground"
      aria-label={flipped ? 'Show summary' : 'Show breakdown'}
    >
      <ArrowDownUp className="h-4 w-4" />
    </button>
  );

  if (!hasAnchor) {
    return (
      <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10"><Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></span>
          <h3 className="text-lg font-semibold">Cash Balance</h3>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Set initial cash balance in{' '}
          <Link to="/settings" className="underline">Settings</Link>{' '}
          to see your balance projection.
        </p>
      </div>
    );
  }

  if (flipped) {
    return (
      <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10"><Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></span>
          <h3 className="text-lg font-semibold">Cash Balance</h3>
          {flipButton}
        </div>
        <div className="mt-3">
          <BreakdownTable {...props} />
        </div>
      </div>
    );
  }

  const showPace = isCurrentPeriod && pacesDiffer && paceEnd !== null;
  const currentBalance = (startingBalance as number) + actualNetChange;

  // 2x2 grid cell values
  const nowValue = isPastPeriod ? pastActualEnd : isCurrentPeriod ? currentBalance : null;
  const nowChange = isPastPeriod ? pastActualNetChange : isCurrentPeriod ? actualNetChange : null;
  const nowLabel = isPastPeriod ? 'Actual end' : 'Now';

  const projEndValue = showPace ? paceEnd : null;
  const projEndChange = showPace ? projectedNetChange : null;

  const plannedEndChange = netChange;


  // "above/below plan" annotation for actual/projected vs planned
  const aboveBelowPlan = (val: number) => {
    if (plannedEnd === null) return null;
    const diff = val - plannedEnd;
    if (Math.abs(diff) < 100) return null;
    return (
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatCents(Math.abs(diff))} {diff >= 0 ? 'above' : 'below'} plan
      </p>
    );
  };

  return (
    <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10"><Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></span>
        <h3 className="text-lg font-semibold">Cash Balance</h3>
        {flipButton}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4">
        {/* Top-left: Started with */}
        <div>
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Clock className="h-3 w-3" />Started with</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">
            {fmtBalance(startingBalance as number)}
          </p>
        </div>

        {/* Top-right: Now / Actual end */}
        {nowValue !== null && nowChange !== null && (
          <div>
            <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">{isPastPeriod ? <CircleCheck className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}{nowLabel}</p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <p className="text-xl font-semibold tabular-nums">
                {fmtBalance(nowValue)}
              </p>
              <span className={cn('text-xs font-semibold tabular-nums', colorForChange(nowChange))}>
                {fmtChange(nowChange)}
              </span>
            </div>
            {isPastPeriod && nowValue !== null && aboveBelowPlan(nowValue)}
          </div>
        )}

        {/* Bottom-left: Planned end */}
        <div className={cn(isPastPeriod && 'opacity-50')}>
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Target className="h-3 w-3" />Planned end</p>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <p className={cn(
              'text-xl font-semibold tabular-nums',
              showDeltas && endDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : '',
            )}>
              {plannedEnd !== null ? fmtBalance(plannedEnd) : '—'}
            </p>
            {plannedEnd !== null && (
              <span className={cn(
                'text-xs font-semibold tabular-nums',
                showDeltas && endDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : colorForChange(plannedEndChange),
              )}>
                {fmtChange(plannedEndChange)}
              </span>
            )}
          </div>
        </div>

        {/* Bottom-right: Projected end */}
        {projEndValue !== null && projEndChange !== null && (
          <div className="-m-2 rounded-lg border border-violet-500/30 bg-violet-500/5 p-2">
            <p className="flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400"><Sparkles className="h-3 w-3" />Projected end</p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <p className="text-xl font-semibold tabular-nums">
                {fmtBalance(projEndValue)}
              </p>
              <span className={cn('text-xs font-semibold tabular-nums', colorForChange(projEndChange))}>
                {fmtChange(projEndChange)}
              </span>
            </div>
            {aboveBelowPlan(projEndValue)}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Shared props for summary cards ---

interface SummaryCardProps {
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
  actualNetChange: number;
  pastActualFixed: number;
  pastActualNetChange: number;
  showDeltas: boolean;
  incomeDelta: number;
  fixedDelta: number;
  variableDelta: number;
  savingsDelta: number;
  endDelta: number;
  pacesDiffer: boolean;
  projectedVariable: number | null;
  projectedNetChange: number;
  projectedSavings: number;
  defaultScenarioName: string;
}

interface CashBalanceCardProps extends SummaryCardProps {
  plannedEnd: number | null;
  paceEnd: number | null;
  pastActualEnd: number | null;
}

interface SavingsGrowthCardProps extends SummaryCardProps {
  totalSavingsBalance: number;
}

// --- Savings Card (2x2 layout matching Cash Balance) ---

function SavingsGrowthCard(props: SavingsGrowthCardProps) {
  const {
    isCurrentPeriod,
    isPastPeriod,
    periodCashFlow,
    showDeltas,
    savingsDelta,
    pacesDiffer,
    projectedSavings,
    totalSavingsBalance,
  } = props;

  const [flipped, setFlipped] = useState(false);

  const savings = periodCashFlow.savings.expected;
  const isFuturePeriod = !isCurrentPeriod && !isPastPeriod;
  const showPace = isCurrentPeriod && pacesDiffer && projectedSavings !== savings;

  const fmtBalance = (amount: number) => {
    if (amount < 0) return `−${formatCents(Math.abs(amount))}`;
    return formatCents(amount);
  };

  const fmtChange = (amount: number) => {
    const sign = amount >= 0 ? '+' : '−';
    return `${sign}${formatCents(Math.abs(amount))}`;
  };

  const colorForChange = () => 'text-blue-600 dark:text-blue-400';

  const flipButton = (
    <button
      type="button"
      onClick={() => setFlipped(!flipped)}
      className="ml-auto cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground"
      aria-label={flipped ? 'Show summary' : 'Show breakdown'}
    >
      <ArrowDownUp className="h-4 w-4" />
    </button>
  );

  if (flipped) {
    return (
      <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10"><PiggyBank className="h-4 w-4 text-blue-600 dark:text-blue-400" /></span>
          <h3 className="text-lg font-semibold">Savings</h3>
          {flipButton}
        </div>
        <div className="mt-3">
          <BreakdownTable {...props} />
        </div>
      </div>
    );
  }

  // For current period: compute absolute savings balances
  const savingsNow = totalSavingsBalance;
  const savingsStarted = savingsNow - periodCashFlow.savings.actual;
  const savingsPlannedEnd = savingsStarted + savings;
  const savingsProjectedEnd = showPace ? savingsStarted + projectedSavings : null;

  // Growth annotations
  const plannedGrowth = savings;
  const actualGrowth = periodCashFlow.savings.actual;
  const projectedGrowth = showPace ? projectedSavings : null;



  return (
    <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10"><PiggyBank className="h-4 w-4 text-blue-600 dark:text-blue-400" /></span>
        <h3 className="text-lg font-semibold">Savings</h3>
        {flipButton}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4">
        {/* Top-left: Started with / Current total */}
        <div>
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Clock className="h-3 w-3" />{isFuturePeriod ? 'Current total' : 'Started with'}
          </p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">
            {fmtBalance(isFuturePeriod ? savingsNow : savingsStarted)}
          </p>
        </div>

        {/* Top-right: Now / Actual end */}
        {!isFuturePeriod && (
          <div>
            <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              {isPastPeriod ? <><CircleCheck className="h-3 w-3" />Actual end</> : <><MapPin className="h-3 w-3" />Now</>}
            </p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <p className="text-xl font-semibold tabular-nums">
                {fmtBalance(isPastPeriod ? savingsStarted + actualGrowth : savingsNow)}
              </p>
              <span className={cn('text-xs font-semibold tabular-nums', colorForChange())}>
                {fmtChange(actualGrowth)}
              </span>
            </div>
          </div>
        )}

        {/* Bottom-left: Planned end */}
        <div className={cn(isPastPeriod && 'opacity-50')}>
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Target className="h-3 w-3" />Planned end</p>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <p className={cn(
              'text-xl font-semibold tabular-nums',
              showDeltas && savingsDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : '',
            )}>
              {fmtBalance(isFuturePeriod ? savingsNow + savings : savingsPlannedEnd)}
            </p>
            <span className={cn(
              'text-xs font-semibold tabular-nums',
              showDeltas && savingsDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : colorForChange(),
            )}>
              {fmtChange(plannedGrowth)}
            </span>
          </div>
        </div>

        {/* Bottom-right: Projected end */}
        {savingsProjectedEnd !== null && projectedGrowth !== null && (
          <div className="-m-2 rounded-lg border border-violet-500/30 bg-violet-500/5 p-2">
            <p className="flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400"><Sparkles className="h-3 w-3" />Projected end</p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <p className="text-xl font-semibold tabular-nums">
                {fmtBalance(savingsProjectedEnd)}
              </p>
              <span className={cn('text-xs font-semibold tabular-nums', colorForChange())}>
                {fmtChange(projectedGrowth)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Breakdown Table (shared by CashChangeCard and SavingsGrowthCard on their back) ---

function BreakdownTable({
  isCurrentPeriod,
  isPastPeriod,
  hasAnchor,
  startingBalance,
  periodCashFlow,
  showDeltas,
  incomeDelta,
  fixedDelta,
  variableDelta,
  savingsDelta,
  pacesDiffer,
  projectedVariable,
  projectedSavings,
}: SummaryCardProps) {
  // Default mobile tab to actual/now (left column = actual in the new order)
  const [mobileColumn, setMobileColumn] = useState<'left' | 'middle' | 'right'>('left');

  const fmtSigned = (amount: number, prefix: string) => `${prefix}${formatCents(Math.abs(amount))}`;

  const renderDelta = (delta: number) => {
    if (!showDeltas || delta === 0) return null;
    return (
      <span className="ml-1.5 text-xs text-violet-600 dark:text-violet-400">
        ({delta > 0 ? '+' : ''}{formatCents(delta)})
      </span>
    );
  };

  const income = periodCashFlow.income.expected;
  const fixed = periodCashFlow.expenses.expected;
  const variable = periodCashFlow.budgeted.expected;
  const savings = periodCashFlow.savings.expected;
  const pastActualFixed = isPastPeriod
    ? Math.max(0, periodCashFlow.expenses.actual - periodCashFlow.projection.variableActual)
    : 0;

  // Column labels based on period type
  const actualLabel = isPastPeriod ? 'Actual' : 'Now';

  // --- Past period: two-column (Actual | Planned) ---
  if (isPastPeriod) {
    return (
      <div>
        <div className="mb-2 flex gap-1 sm:hidden">
          <button type="button" onClick={() => setMobileColumn('left')} className={cn('cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors', mobileColumn === 'left' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>{actualLabel}</button>
          <button type="button" onClick={() => setMobileColumn('right')} className={cn('cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors', mobileColumn === 'right' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>Planned</button>
        </div>
        <div className="mb-2 hidden sm:grid sm:grid-cols-[1fr_auto_auto] sm:gap-x-4">
          <div />
          <div className="w-28 text-right text-xs font-medium text-muted-foreground">{actualLabel}</div>
          <div className="w-28 text-right text-xs font-medium text-muted-foreground">Planned</div>
        </div>
        <div className="border-t border-border pt-2">
          <TwoColRow label="Started with" left={hasAnchor ? formatCents(startingBalance as number) : '—'} right="" mobileColumn={mobileColumn} />
          <TwoColRow label="+ Income" left={fmtSigned(periodCashFlow.income.actual, '+')} right={fmtSigned(income, '+')} mobileColumn={mobileColumn} className="text-green-600 dark:text-green-400" dimRight />
          <TwoColRow label="− Fixed expenses" left={pastActualFixed > 0 ? fmtSigned(pastActualFixed, '−') : '—'} right={fixed > 0 ? fmtSigned(fixed, '−') : '—'} mobileColumn={mobileColumn} className="text-red-600 dark:text-red-400" dimRight />
          <TwoColRow label="− Variable spending" left={periodCashFlow.projection.variableActual > 0 ? fmtSigned(periodCashFlow.projection.variableActual, '−') : '—'} right={variable > 0 ? fmtSigned(variable, '−') : '—'} mobileColumn={mobileColumn} className="text-red-600 dark:text-red-400" dimRight />
          <TwoColRow label="− Saving" left={fmtSigned(periodCashFlow.savings.actual, '−')} right={fmtSigned(savings, '−')} mobileColumn={mobileColumn} className="text-blue-600 dark:text-blue-400" dimRight />
        </div>
      </div>
    );
  }

  // --- Current period with divergent pace: three-column (Now | Projected | Planned) ---
  if (isCurrentPeriod && pacesDiffer) {
    const pv = projectedVariable ?? variable;
    return (
      <div>
        <div className="mb-2 flex gap-1 sm:hidden">
          {(['left', 'middle', 'right'] as const).map((col) => (
            <button key={col} type="button" onClick={() => setMobileColumn(col)} className={cn('cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors', mobileColumn === col ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
              {col === 'left' ? actualLabel : col === 'middle' ? 'Projected' : 'Planned'}
            </button>
          ))}
        </div>
        <div className="mb-2 hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:gap-x-4">
          <div />
          <div className="w-28 text-right text-xs font-medium text-muted-foreground">{actualLabel}</div>
          <div className="w-28 text-right text-xs font-medium text-violet-600 dark:text-violet-400">
            <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" />Projected</span>
          </div>
          <div className="w-28 text-right text-xs font-medium text-muted-foreground">Planned</div>
        </div>
        <div className="border-t border-border pt-2">
          <ThreeColRow label="Started with" left={hasAnchor ? formatCents(startingBalance as number) : '—'} middle={hasAnchor ? formatCents(startingBalance as number) : '—'} right={hasAnchor ? formatCents(startingBalance as number) : '—'} mobileColumn={mobileColumn} />
          <ThreeColRow label="+ Income" left={fmtSigned(periodCashFlow.income.actual, '+')} middle={fmtSigned(income, '+')} right={fmtSigned(income, '+')} leftColor="text-green-600 dark:text-green-400" middleColor="text-green-600 dark:text-green-400" rightColor={showDeltas && incomeDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : 'text-green-600 dark:text-green-400'} mobileColumn={mobileColumn} dimMiddle dimRight />
          <ThreeColRow label="− Fixed expenses" left={periodCashFlow.expenses.dueToDate > 0 ? fmtSigned(periodCashFlow.expenses.dueToDate, '−') : '—'} middle={fixed > 0 ? fmtSigned(fixed, '−') : '—'} right={fixed > 0 ? fmtSigned(fixed, '−') : '—'} leftColor="text-red-600 dark:text-red-400" middleColor="text-red-600 dark:text-red-400" rightColor={showDeltas && fixedDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400'} mobileColumn={mobileColumn} dimMiddle dimRight />
          <ThreeColRow label="− Variable spending" left={periodCashFlow.projection.variableActual > 0 ? fmtSigned(periodCashFlow.projection.variableActual, '−') : '—'} middle={pv > 0 ? fmtSigned(pv, '−') : '—'} right={variable > 0 ? fmtSigned(variable, '−') : '—'} leftColor="text-red-600 dark:text-red-400" middleColor="text-red-600 dark:text-red-400" rightColor={showDeltas && variableDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400'} mobileColumn={mobileColumn} dimRight />
          <ThreeColRow label="− Saving" left={fmtSigned(periodCashFlow.savings.actual, '−')} middle={fmtSigned(projectedSavings, '−')} right={fmtSigned(savings, '−')} leftColor="text-blue-600 dark:text-blue-400" middleColor="text-blue-600 dark:text-blue-400" rightColor={showDeltas && savingsDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : 'text-blue-600 dark:text-blue-400'} mobileColumn={mobileColumn} dimMiddle={projectedSavings === savings} dimRight />
        </div>
      </div>
    );
  }

  // --- Current period (on track): two-column (Now | Planned) ---
  if (isCurrentPeriod) {
    return (
      <div>
        <div className="mb-2 flex gap-1 sm:hidden">
          <button type="button" onClick={() => setMobileColumn('left')} className={cn('cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors', mobileColumn === 'left' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>{actualLabel}</button>
          <button type="button" onClick={() => setMobileColumn('right')} className={cn('cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors', mobileColumn === 'right' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>Planned</button>
        </div>
        <div className="mb-2 hidden sm:grid sm:grid-cols-[1fr_auto_auto] sm:gap-x-4">
          <div />
          <div className="w-28 text-right text-xs font-medium text-muted-foreground">{actualLabel}</div>
          <div className="w-28 text-right text-xs font-medium text-muted-foreground">Planned</div>
        </div>
        <div className="border-t border-border pt-2">
          <TwoColRow label="Started with" left={hasAnchor ? formatCents(startingBalance as number) : '—'} right="" mobileColumn={mobileColumn} />
          <TwoColRow label="+ Income" left={fmtSigned(periodCashFlow.income.actual, '+')} right={fmtSigned(income, '+')} mobileColumn={mobileColumn} leftColor="text-green-600 dark:text-green-400" rightColor={showDeltas && incomeDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : 'text-green-600 dark:text-green-400'} dimRight />
          <TwoColRow label="− Fixed expenses" left={periodCashFlow.expenses.dueToDate > 0 ? fmtSigned(periodCashFlow.expenses.dueToDate, '−') : '—'} right={fixed > 0 ? fmtSigned(fixed, '−') : '—'} mobileColumn={mobileColumn} leftColor="text-red-600 dark:text-red-400" rightColor={showDeltas && fixedDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400'} dimRight />
          <TwoColRow label="− Variable spending" left={periodCashFlow.projection.variableActual > 0 ? fmtSigned(periodCashFlow.projection.variableActual, '−') : '—'} right={variable > 0 ? fmtSigned(variable, '−') : '—'} mobileColumn={mobileColumn} leftColor="text-red-600 dark:text-red-400" rightColor={showDeltas && variableDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400'} dimRight />
          <TwoColRow label="− Saving" left={fmtSigned(periodCashFlow.savings.actual, '−')} right={fmtSigned(savings, '−')} mobileColumn={mobileColumn} leftColor="text-blue-600 dark:text-blue-400" rightColor={showDeltas && savingsDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : 'text-blue-600 dark:text-blue-400'} dimRight />
        </div>
      </div>
    );
  }

  // --- Future period: single-column ---
  return (
    <div>
      <div className="border-t border-border pt-2">
        <SingleRow label="Started with" value={hasAnchor ? formatCents(startingBalance as number) : '—'} {...(hasAnchor ? { href: '/settings' } : {})} />
        <SingleRow label="+ Income" value={fmtSigned(income, '+')} delta={renderDelta(incomeDelta)} className="text-green-600 dark:text-green-400" valueColor={showDeltas && incomeDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : undefined} href="/budget?section=income" />
        <SingleRow label="− Fixed expenses" value={fixed > 0 ? fmtSigned(fixed, '−') : '—'} delta={renderDelta(-fixedDelta)} className="text-red-600 dark:text-red-400" valueColor={showDeltas && fixedDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : undefined} href="/budget?section=fixed" />
        <SingleRow label="− Variable spending" value={variable > 0 ? fmtSigned(variable, '−') : '—'} delta={renderDelta(-variableDelta)} className="text-red-600 dark:text-red-400" valueColor={showDeltas && variableDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : undefined} href="/budget?section=variable" />
        <SingleRow label="− Saving" value={fmtSigned(savings, '−')} delta={renderDelta(-savingsDelta)} className="text-blue-600 dark:text-blue-400" valueColor={showDeltas && savingsDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : undefined} href="/budget?section=savings" />
      </div>
    </div>
  );
}

// --- Shared sub-components ---

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
  dimValue = false,
  annotationColor,
}: {
  label: React.ReactNode;
  value: string;
  delta?: React.ReactNode;
  annotation?: string | undefined;
  valueColor?: string | undefined;
  className?: string;
  href?: string;
  isBold?: boolean;
  dimValue?: boolean;
  annotationColor?: string | undefined;
}) {
  const dimCls = dimValue ? 'opacity-50' : '';
  const valContent = href ? (
    <Link to={href} className={cn('w-20 text-right font-mono text-sm tabular-nums hover:underline sm:w-28', isBold && 'font-semibold', className, valueColor, dimCls)}>
      {value}
    </Link>
  ) : (
    <span className={cn('w-20 text-right font-mono text-sm tabular-nums sm:w-28', isBold && 'font-semibold', className, valueColor, dimCls)}>
      {value}
    </span>
  );

  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 py-0.5 sm:gap-x-4">
      <span className={cn('text-sm text-muted-foreground', isBold && 'font-semibold text-foreground')}>
        {label}
        {delta}
      </span>
      {valContent}
      <span className={cn('w-16 text-right text-xs self-center sm:w-28', annotationColor ? `text-sm font-semibold font-mono tabular-nums ${annotationColor}` : 'text-muted-foreground')}>
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
  dimLeft = false,
  dimRight = false,
}: {
  label: React.ReactNode;
  left: string;
  right: string;
  leftColor?: string | undefined;
  rightColor?: string | undefined;
  className?: string;
  leftHref?: string;
  mobileColumn: 'left' | 'middle' | 'right';
  isBold?: boolean;
  dimLeft?: boolean;
  dimRight?: boolean;
}) {
  const valCls = cn('w-28 text-right font-mono text-sm tabular-nums', isBold && 'font-semibold', className);
  const dimLeftCls = dimLeft ? 'opacity-50' : '';
  const dimRightCls = dimRight ? 'opacity-50' : '';
  // In two-column mode, 'middle' falls back to 'left'
  const effectiveMobileCol = mobileColumn === 'middle' ? 'left' : mobileColumn;

  const leftContent = leftHref ? (
    <Link to={leftHref} className={cn(valCls, leftColor, dimLeftCls, 'hover:underline')}>{left}</Link>
  ) : (
    <span className={cn(valCls, leftColor, dimLeftCls)}>{left}</span>
  );

  const rightContent = <span className={cn(valCls, rightColor, dimRightCls)}>{right}</span>;

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
        {effectiveMobileCol === 'left' ? (
          leftHref ? (
            <Link to={leftHref} className={cn(valCls, leftColor, dimLeftCls, 'hover:underline')}>{left}</Link>
          ) : (
            <span className={cn(valCls, leftColor, dimLeftCls)}>{left}</span>
          )
        ) : (
          <span className={cn(valCls, rightColor, dimRightCls)}>{right}</span>
        )}
      </div>
    </>
  );
}

/** Three-column ledger row (current period with divergent pace: Planned / Projected / Actual) */
function ThreeColRow({
  label,
  left,
  middle,
  right,
  leftColor,
  middleColor,
  rightColor,
  leftHref,
  mobileColumn,
  isBold = false,
  dimLeft = false,
  dimMiddle = false,
  dimRight = false,
}: {
  label: React.ReactNode;
  left: string;
  middle: string;
  right: string;
  leftColor?: string | undefined;
  middleColor?: string | undefined;
  rightColor?: string | undefined;
  leftHref?: string;
  mobileColumn: 'left' | 'middle' | 'right';
  isBold?: boolean;
  dimLeft?: boolean;
  dimMiddle?: boolean;
  dimRight?: boolean;
}) {
  const valCls = cn('w-28 text-right font-mono text-sm tabular-nums', isBold && 'font-semibold');
  const dimLeftCls = dimLeft ? 'opacity-50' : '';
  const dimMiddleCls = dimMiddle ? 'opacity-50' : '';
  const dimRightCls = dimRight ? 'opacity-50' : '';

  const leftContent = leftHref ? (
    <Link to={leftHref} className={cn(valCls, leftColor, dimLeftCls, 'hover:underline')}>{left}</Link>
  ) : (
    <span className={cn(valCls, leftColor, dimLeftCls)}>{left}</span>
  );

  const middleContent = <span className={cn(valCls, middleColor, dimMiddleCls)}>{middle}</span>;
  const rightContent = <span className={cn(valCls, rightColor, dimRightCls)}>{right}</span>;

  // Mobile: pick one column based on tab
  const mobileValue = mobileColumn === 'left'
    ? (leftHref
        ? <Link to={leftHref} className={cn(valCls, leftColor, dimLeftCls, 'hover:underline')}>{left}</Link>
        : <span className={cn(valCls, leftColor, dimLeftCls)}>{left}</span>)
    : mobileColumn === 'middle'
      ? <span className={cn(valCls, middleColor, dimMiddleCls)}>{middle}</span>
      : <span className={cn(valCls, rightColor, dimRightCls)}>{right}</span>;

  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:gap-x-4 sm:py-0.5">
        <span className={cn('text-sm text-muted-foreground', isBold && 'font-semibold text-foreground')}>{label}</span>
        {leftContent}
        {middleContent}
        {rightContent}
      </div>
      {/* Mobile */}
      <div className="grid grid-cols-[1fr_auto] gap-x-4 py-0.5 sm:hidden">
        <span className={cn('text-sm text-muted-foreground', isBold && 'font-semibold text-foreground')}>{label}</span>
        {mobileValue}
      </div>
    </>
  );
}
