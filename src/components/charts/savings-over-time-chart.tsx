import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { formatCents, formatCentsShort, formatMonth } from '@/lib/utils';
import { CHART_COLORS } from '@/lib/chart-colors';

type LegendKey = 'actual' | 'forecast';

interface MonthlySavings {
  month: string;
  actual: number;
  forecast: number;
  cumulativeActual: number;
  cumulativeForecast: number;
}

interface SavingsOverTimeChartProps {
  monthlySavings: MonthlySavings[];
  deadline?: string | undefined; // ISO date string for goal deadline
  targetAmount?: number | undefined; // Target amount in cents for the goal
  startingBalance?: number | undefined; // Balance at start of date range (for individual goals)
  balanceStartMonth?: string | null | undefined; // Month to start showing balance (if anchor is mid-range)
}

interface ChartDataPoint {
  month: string;
  actual: number;
  forecast: number;
  cumulativeActual: number | null; // Includes startingBalance, null before balanceStartMonth
  cumulativeForecast: number;
  cumulativeTotal: number | null; // Includes startingBalance, null before balanceStartMonth
}

interface TooltipPayload {
  name: string;
  value: number;
  dataKey: string;
  payload: ChartDataPoint;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const monthTotal = data.actual + data.forecast;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm">
      <p className="mb-2 font-medium">{label ? formatMonth(label) : ''}</p>
      <div className="space-y-1 text-sm">
        {data.actual > 0 && (
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: CHART_COLORS.savings }}
            />
            <span className="text-muted-foreground">Actual this month:</span>
            <span className="font-mono text-blue-600">+{formatCents(data.actual)}</span>
          </div>
        )}
        {data.forecast > 0 && (
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: `${CHART_COLORS.savings}60` }}
            />
            <span className="text-muted-foreground">Expected this month:</span>
            <span className="font-mono text-blue-400">+{formatCents(data.forecast)}</span>
          </div>
        )}
        {monthTotal > 0 && data.actual > 0 && data.forecast > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Month total:</span>
            <span className="font-mono">+{formatCents(monthTotal)}</span>
          </div>
        )}
      </div>
      {data.cumulativeActual !== null && (
        <div className="mt-2 border-t pt-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Total saved:</span>
            <span className="font-mono font-medium">{formatCents(data.cumulativeActual)}</span>
          </div>
          {data.cumulativeForecast > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">+ Expected:</span>
              <span className="font-mono text-blue-400">+{formatCents(data.cumulativeForecast)}</span>
            </div>
          )}
          {data.cumulativeForecast > 0 && data.cumulativeTotal !== null && (
            <div className="flex items-center gap-2 font-medium">
              <span className="text-muted-foreground">Projected total:</span>
              <span className="font-mono">{formatCents(data.cumulativeTotal)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SavingsOverTimeChart({ monthlySavings, deadline, targetAmount, startingBalance = 0, balanceStartMonth }: SavingsOverTimeChartProps) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const hasCurrentMonth = monthlySavings.some((m) => m.month === currentMonth);

  // Legend visibility state
  const [hiddenLegends, setHiddenLegends] = useState<Set<LegendKey>>(new Set());
  const toggleLegend = (key: LegendKey) => {
    setHiddenLegends((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Check if deadline month is within the chart range
  const deadlineMonth = deadline?.slice(0, 7);
  const hasDeadline = deadlineMonth && monthlySavings.some((m) => m.month === deadlineMonth);

  // Find the month when target is reached (if target is set)
  // Need to add startingBalance to cumulative values since they start from 0 for the date range
  const targetReachedMonth = targetAmount && targetAmount > 0
    ? monthlySavings.find((m) => startingBalance + m.cumulativeActual + m.cumulativeForecast >= targetAmount)?.month
    : undefined;

  // Calculate "Expected" line color based on deadline comparison
  // Green: on or before deadline, Amber: 1-2 months late, Red: 3+ months late
  const getExpectedColor = () => {
    if (!targetReachedMonth || !deadlineMonth) return '#22c55e'; // Green if no deadline

    if (targetReachedMonth <= deadlineMonth) return '#22c55e'; // Green - on track

    // Calculate how many months over deadline
    const [expectedYear, expectedMonthNum] = targetReachedMonth.split('-').map(Number);
    const [deadlineYear, deadlineMonthNum] = deadlineMonth.split('-').map(Number);
    const expectedMonths = expectedYear! * 12 + expectedMonthNum!;
    const deadlineMonths = deadlineYear! * 12 + deadlineMonthNum!;
    const monthsOver = expectedMonths - deadlineMonths;

    if (monthsOver <= 2) return '#f59e0b'; // Amber - 1-2 months late
    return '#ef4444'; // Red - 3+ months late
  };

  const expectedColor = getExpectedColor();

  const hasContributions = monthlySavings.some((m) => m.actual > 0 || m.forecast > 0);
  const hasForecast = monthlySavings.some((m) => m.forecast > 0);
  // Consider data present if there's a starting balance (from anchor) OR contributions
  const hasSavings = hasContributions || startingBalance > 0;

  // Check if all legend items are hidden
  const allHidden = hiddenLegends.has('actual') && (!hasForecast || hiddenLegends.has('forecast'));

  if (!hasSavings) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No savings data in this period.
      </div>
    );
  }

  // Transform data to show stacked cumulative values
  // Include startingBalance so the chart Y values match the target line
  // Only show balance data from balanceStartMonth onwards (like cash flow chart)
  const chartData = monthlySavings.map((m) => {
    // Before balanceStartMonth, don't show cumulative values (they'll be null/hidden)
    const showBalance = !balanceStartMonth || m.month >= balanceStartMonth;

    return {
      month: m.month,
      actual: m.actual,
      forecast: m.forecast,
      cumulativeActual: showBalance ? startingBalance + m.cumulativeActual : null,
      cumulativeForecast: m.cumulativeForecast,
      // For stacked area, we need the total for the forecast layer
      cumulativeTotal: showBalance ? startingBalance + m.cumulativeActual + m.cumulativeForecast : null,
    };
  });

  return (
    <div className="w-full">
      {allHidden ? (
        <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          All data hidden. Click a legend item to show it.
        </div>
      ) : (
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData} margin={{ top: 20, right: 55, bottom: 20, left: 10 }}>
          <defs>
            <linearGradient id="actualSavingsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.savings} stopOpacity={0.4} />
              <stop offset="95%" stopColor={CHART_COLORS.savings} stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="forecastSavingsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.savings} stopOpacity={0.2} />
              <stop offset="95%" stopColor={CHART_COLORS.savings} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            tickFormatter={(value) => formatMonth(value)}
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value) => formatCentsShort(value)}
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* "Now" reference line - only show if current month is in range */}
          {hasCurrentMonth && (
            <ReferenceLine
              x={currentMonth}
              stroke="#6b7280"
              strokeWidth={2}
              label={{
                value: 'Now',
                position: 'top',
                fontSize: 11,
                fill: '#6b7280',
              }}
            />
          )}

          {/* Deadline reference line - always grey */}
          {hasDeadline && (
            <ReferenceLine
              x={deadlineMonth}
              stroke="#6b7280"
              strokeWidth={2}
              strokeDasharray="4 4"
              label={{
                value: 'Deadline',
                position: 'top',
                fontSize: 11,
                fill: '#6b7280',
              }}
            />
          )}

          {/* Target amount horizontal line */}
          {targetAmount && targetAmount > 0 && (
            <ReferenceLine
              y={targetAmount}
              stroke="#22c55e"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{
                value: 'Target',
                position: 'right',
                fontSize: 11,
                fill: '#22c55e',
              }}
            />
          )}

          {/* Goal reached vertical line - only show if in future, color based on deadline comparison */}
          {targetReachedMonth && targetReachedMonth > currentMonth && (
            <ReferenceLine
              x={targetReachedMonth}
              stroke={expectedColor}
              strokeWidth={2}
              label={{
                value: 'Goal reached',
                position: 'top',
                fontSize: 11,
                fill: expectedColor,
              }}
            />
          )}

          {hasForecast && !hiddenLegends.has('forecast') && (
            <Area
              type="monotone"
              dataKey="cumulativeTotal"
              name="Projected Total"
              stroke={`${CHART_COLORS.savings}60`}
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="url(#forecastSavingsGradient)"
            />
          )}
          {!hiddenLegends.has('actual') && (
            <Area
              type="monotone"
              dataKey="cumulativeActual"
              name="Actual Savings"
              stroke={CHART_COLORS.savings}
              strokeWidth={2}
              fill="url(#actualSavingsGradient)"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="mt-3 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => toggleLegend('actual')}
          className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-all hover:bg-muted ${
            hiddenLegends.has('actual') ? 'opacity-40' : ''
          }`}
        >
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: CHART_COLORS.savings }}
          />
          <span className={hiddenLegends.has('actual') ? 'line-through' : ''}>Actual Savings</span>
        </button>
        {hasForecast && (
          <button
            type="button"
            onClick={() => toggleLegend('forecast')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-all hover:bg-muted ${
              hiddenLegends.has('forecast') ? 'opacity-40' : ''
            }`}
          >
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: `${CHART_COLORS.savings}60` }}
            />
            <span className={hiddenLegends.has('forecast') ? 'line-through' : ''}>Planned contributions</span>
          </button>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Data includes interest.
      </p>
    </div>
  );
}
