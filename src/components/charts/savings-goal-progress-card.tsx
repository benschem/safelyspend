import { useMemo } from 'react';
import { Target, Calendar, TrendingUp, CheckCircle2, PiggyBank, Ambulance } from 'lucide-react';
import { formatCents, formatMonth } from '@/lib/utils';

interface MonthlySavings {
  month: string;
  actual: number;
  forecast: number;
  cumulativeActual: number;
  cumulativeForecast: number;
}

interface SavingsGoalProgressCardProps {
  goalName: string;
  targetAmount: number;
  currentBalance: number;
  deadline: string | undefined;
  annualInterestRate: number | undefined;
  monthlySavings: MonthlySavings[];
  isEmergencyFund?: boolean;
}

/**
 * Calculate expected completion month based on current balance, monthly contributions, and interest
 */
function calculateExpectedCompletion(
  currentBalance: number,
  targetAmount: number,
  monthlySavings: MonthlySavings[],
  annualInterestRate: number | undefined,
): { month: string; monthsAway: number } | null {
  if (targetAmount <= 0) return null;
  if (currentBalance >= targetAmount) return { month: 'reached', monthsAway: 0 };

  // Calculate average monthly contribution from the data
  const totalContributions = monthlySavings.reduce(
    (sum, m) => sum + m.actual + m.forecast,
    0,
  );
  const monthCount = monthlySavings.length || 1;
  const avgMonthlyContribution = totalContributions / monthCount;

  if (avgMonthlyContribution <= 0 && (!annualInterestRate || annualInterestRate <= 0)) {
    return null; // No way to reach goal
  }

  const monthlyRate = annualInterestRate ? annualInterestRate / 100 / 12 : 0;
  let balance = currentBalance;
  let months = 0;
  const maxMonths = 600; // 50 years max

  // Simulate month by month
  while (balance < targetAmount && months < maxMonths) {
    balance += avgMonthlyContribution;
    balance += balance * monthlyRate; // Compound interest
    months++;
  }

  if (months >= maxMonths) return null;

  // Calculate the actual month
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + months, 1);
  const targetMonth = targetDate.toISOString().slice(0, 7);

  return { month: targetMonth, monthsAway: months };
}

export function SavingsGoalProgressCard({
  goalName,
  targetAmount,
  currentBalance,
  deadline,
  annualInterestRate,
  monthlySavings,
  isEmergencyFund,
}: SavingsGoalProgressCardProps) {
  const percentComplete = targetAmount > 0
    ? Math.min(100, (currentBalance / targetAmount) * 100)
    : 0;

  const isGoalReached = currentBalance >= targetAmount && targetAmount > 0;

  const expectedCompletion = useMemo(
    () => calculateExpectedCompletion(currentBalance, targetAmount, monthlySavings, annualInterestRate),
    [currentBalance, targetAmount, monthlySavings, annualInterestRate],
  );

  // Calculate timeframe relative to deadline
  const timeframeInfo = useMemo((): {
    label: string;
    status: 'early' | 'on-time' | 'slightly-late' | 'late';
  } | null => {
    if (!expectedCompletion || expectedCompletion.month === 'reached' || !deadline) return null;

    const deadlineMonth = deadline.slice(0, 7);
    const [expectedYear, expectedMonthNum] = expectedCompletion.month.split('-').map(Number);
    const [deadlineYear, deadlineMonthNum] = deadlineMonth.split('-').map(Number);

    // Calculate difference in days for more precision
    const expectedDate = new Date(expectedYear!, expectedMonthNum! - 1, 1);
    const deadlineDate = new Date(deadlineYear!, deadlineMonthNum! - 1, 1);
    const diffMs = expectedDate.getTime() - deadlineDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const absDays = Math.abs(diffDays);

    // Format the time difference
    const formatDiff = (days: number): string => {
      if (days < 7) {
        return `${days} day${days === 1 ? '' : 's'}`;
      } else if (days < 28) {
        const weeks = Math.round(days / 7);
        return `${weeks} week${weeks === 1 ? '' : 's'}`;
      } else {
        const months = Math.round(days / 30);
        if (months > 12) {
          const years = Math.floor(months / 12);
          const remainingMonths = months % 12;
          if (remainingMonths === 0) {
            return `${years} year${years === 1 ? '' : 's'}`;
          }
          return `${years} year${years === 1 ? '' : 's'} ${remainingMonths} month${remainingMonths === 1 ? '' : 's'}`;
        }
        return `${months} month${months === 1 ? '' : 's'}`;
      }
    };

    if (diffDays < 0) {
      return { label: `${formatDiff(absDays)} early`, status: 'early' };
    } else if (diffDays === 0) {
      return { label: 'On time', status: 'on-time' };
    } else {
      const months = Math.round(absDays / 30);
      const status = months <= 2 ? 'slightly-late' : 'late';
      return { label: `${formatDiff(absDays)} late`, status };
    }
  }, [deadline, expectedCompletion]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 truncate font-medium">
            {isEmergencyFund ? (
              <Ambulance className="h-4 w-4 shrink-0 text-blue-500" />
            ) : (
              <PiggyBank className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            {goalName}
          </h4>
          {targetAmount > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{formatCents(currentBalance)}</span>
              <span> of </span>
              <span className="font-mono">{formatCents(targetAmount)}</span>
            </p>
          )}
        </div>
        {isGoalReached ? (
          <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Reached
          </div>
        ) : targetAmount > 0 ? (
          <div className="text-right">
            <div className="text-lg font-semibold">{percentComplete.toFixed(0)}%</div>
          </div>
        ) : null}
      </div>

      {/* Progress bar */}
      {targetAmount > 0 && !isGoalReached && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {/* Expected completion - neutral color */}
        {!isGoalReached && expectedCompletion && targetAmount > 0 && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Target className="h-3.5 w-3.5" />
            <span>
              Expected{' '}
              <span className="font-medium text-foreground">
                {formatMonth(expectedCompletion.month)}
              </span>
            </span>
          </div>
        )}

        {/* Timeframe early/late - colored */}
        {!isGoalReached && timeframeInfo && (
          <div
            className={`flex items-center gap-1.5 font-medium ${
              timeframeInfo.status === 'early' || timeframeInfo.status === 'on-time'
                ? 'text-green-600 dark:text-green-400'
                : timeframeInfo.status === 'slightly-late'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>{timeframeInfo.label}</span>
          </div>
        )}

        {/* Interest rate */}
        {annualInterestRate && annualInterestRate > 0 && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>
              <span className="font-medium text-foreground">{annualInterestRate}%</span> p.a.
            </span>
          </div>
        )}
      </div>

      {/* No target set message */}
      {targetAmount <= 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          No target amount set. Currently saved{' '}
          <span className="font-mono font-medium">{formatCents(currentBalance)}</span>.
        </p>
      )}

      {/* No progress message */}
      {!isGoalReached && targetAmount > 0 && !expectedCompletion && currentBalance === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Start saving to see your expected completion date.
        </p>
      )}
    </div>
  );
}
