import { Link } from 'react-router';
import {
  Banknote,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  PiggyBank,
  Sparkles,
  Target,
} from 'lucide-react';
import { cn, formatCents } from '@/lib/utils';

/**
 * The two summary cards at the top of the cash flow page. Both are presentational:
 * they take already-computed figures so the page can feed them live data and the
 * landing page can feed them a fixture.
 */

interface CashBalanceCardProps {
  isCurrentPeriod: boolean;
  isPastPeriod: boolean;
  hasAnchor: boolean;
  showDeltas: boolean;
  netChange: number;
  projectedNetChange: number;
  pastActualNetChange: number;
  plannedEnd: number | null;
  paceEnd: number | null;
  pastActualEnd: number | null;
}

interface SavingsGrowthCardProps {
  isCurrentPeriod: boolean;
  isPastPeriod: boolean;
  periodCashFlow: { savings: { expected: number; actual: number } };
  showDeltas: boolean;
  savingsDelta: number;
  pacesDiffer: boolean;
  projectedSavings: number;
  totalSavingsBalance: number;
}

export function CashBalanceCard(props: CashBalanceCardProps) {
  const {
    isCurrentPeriod,
    isPastPeriod,
    hasAnchor,
    showDeltas,
    netChange,
    projectedNetChange,
    pastActualNetChange,
    plannedEnd,
    paceEnd,
    pastActualEnd,
  } = props;

  const fmtBalance = (amount: number) => {
    if (amount < 0) return `−${formatCents(Math.abs(amount))}`;
    return formatCents(amount);
  };

  const colorForChange = (amount: number) =>
    amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';

  if (!hasAnchor) {
    return (
      <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10">
            <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </span>
          <h3 className="text-lg font-semibold">Cash Balance</h3>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Set initial cash balance in{' '}
          <Link to="/settings" className="underline">
            Settings
          </Link>{' '}
          to see your balance projection.
        </p>
      </div>
    );
  }

  // Determine which value/label/change to show based on period
  const isFuture = !isCurrentPeriod && !isPastPeriod;
  let endValue: number | null;
  let endChange: number;
  let endLabel: string;
  let endIcon: React.ReactNode;

  if (isPastPeriod) {
    endValue = pastActualEnd ?? null;
    endChange = pastActualNetChange;
    endLabel = 'Actual month end';
    endIcon = <CalendarCheck className="h-3 w-3" />;
  } else if (isCurrentPeriod) {
    endValue = paceEnd !== null ? paceEnd : plannedEnd;
    endChange = projectedNetChange;
    endLabel = 'Projected month end';
    endIcon = <Sparkles className="h-3 w-3" />;
  } else {
    endValue = plannedEnd;
    endChange = netChange;
    endLabel = 'Planned month end';
    endIcon = <Target className="h-3 w-3" />;
  }

  // "ahead/behind plan" pill (only for current period)
  const aboveBelowPill =
    isCurrentPeriod &&
    endValue !== null &&
    plannedEnd !== null &&
    (() => {
      const diff = endValue! - plannedEnd;
      if (Math.abs(diff) < 100) return null;
      const isAhead = diff >= 0;
      return (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            isAhead
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
          )}
        >
          {formatCents(Math.abs(diff))} {isAhead ? 'ahead' : 'behind'}
        </span>
      );
    })();

  const labelClass = isCurrentPeriod
    ? 'text-violet-600 dark:text-violet-400'
    : 'text-muted-foreground';

  return (
    <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10">
            <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </span>
          <h3 className="text-lg font-semibold">Cash</h3>
        </div>
        {aboveBelowPill}
      </div>

      {endValue !== null && (
        <div className="mt-6">
          <p className={cn('flex items-center gap-1 text-xs font-medium', labelClass)}>
            {endIcon}
            {endLabel}
          </p>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <p
              className={cn(
                'text-3xl font-semibold tabular-nums',
                showDeltas && isFuture && 'text-violet-600 dark:text-violet-400',
              )}
            >
              {fmtBalance(endValue)}
            </p>
            <span
              className={cn(
                'inline-flex items-center text-xs font-semibold tabular-nums',
                colorForChange(endChange),
              )}
            >
              {endChange >= 0 ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              {formatCents(Math.abs(endChange))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Savings Card (2x2 layout matching Cash Balance) ---

export function SavingsGrowthCard(props: SavingsGrowthCardProps) {
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

  const savings = periodCashFlow.savings.expected;
  const isFuturePeriod = !isCurrentPeriod && !isPastPeriod;
  const showPace = isCurrentPeriod && pacesDiffer && projectedSavings !== savings;

  const fmtBalance = (amount: number) => {
    if (amount < 0) return `−${formatCents(Math.abs(amount))}`;
    return formatCents(amount);
  };

  const colorForChange = () => 'text-blue-600 dark:text-blue-400';

  // For current period: compute absolute savings balances
  const savingsNow = totalSavingsBalance;
  const savingsStarted = savingsNow - periodCashFlow.savings.actual;
  const savingsPlannedEnd = savingsStarted + savings;
  const savingsProjectedEnd = showPace ? savingsStarted + projectedSavings : null;

  // Growth annotations
  const plannedGrowth = savings;
  const projectedGrowth = showPace ? projectedSavings : null;

  return (
    <div className={cn('rounded-xl border bg-card p-5', showDeltas && 'border-violet-500/30')}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10">
          <PiggyBank className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </span>
        <h3 className="text-lg font-semibold">Savings</h3>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 items-end">
        {/* Past: Actual month end */}
        {isPastPeriod && (
          <div>
            <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <CalendarCheck className="h-3 w-3" />
              Actual month end
            </p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <p className="text-3xl font-semibold tabular-nums">{fmtBalance(savingsNow)}</p>
              <span
                className={cn(
                  'inline-flex items-center text-xs font-semibold tabular-nums',
                  colorForChange(),
                )}
              >
                {periodCashFlow.savings.actual >= 0 ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {formatCents(Math.abs(periodCashFlow.savings.actual))}
              </span>
            </div>
          </div>
        )}

        {/* Current/Future: Planned month end */}
        {!isPastPeriod && (
          <div>
            <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Target className="h-3 w-3" />
              Planned month end
            </p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <p
                className={cn(
                  'text-3xl font-semibold tabular-nums',
                  showDeltas && savingsDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : '',
                )}
              >
                {fmtBalance(isFuturePeriod ? savingsNow + savings : savingsPlannedEnd)}
              </p>
              <span
                className={cn(
                  'inline-flex items-center text-xs font-semibold tabular-nums',
                  colorForChange(),
                )}
              >
                {plannedGrowth >= 0 ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {formatCents(Math.abs(plannedGrowth))}
              </span>
            </div>
          </div>
        )}

        {/* Current (divergent): Projected month end */}
        {savingsProjectedEnd !== null && projectedGrowth !== null && (
          <div>
            <p className="flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400">
              <Sparkles className="h-3 w-3" />
              Projected month end
            </p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <p className="text-3xl font-semibold tabular-nums">
                {fmtBalance(savingsProjectedEnd)}
              </p>
              <span
                className={cn(
                  'inline-flex items-center text-xs font-semibold tabular-nums',
                  colorForChange(),
                )}
              >
                {projectedGrowth >= 0 ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {formatCents(Math.abs(projectedGrowth))}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
