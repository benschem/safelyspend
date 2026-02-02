import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { formatCents } from '@/lib/utils';
import { CHART_COLORS } from '@/lib/chart-colors';

interface DailySpending {
  date: string;
  amount: number;
}

interface BurnRateChartProps {
  dailySpending: DailySpending[];
  totalBudget: number;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  compact?: boolean;
  /** View mode affects x-axis: year/quarter show months, month shows days */
  viewMode?: 'year' | 'quarter' | 'month';
  /** Positive surplus amount (in cents) - shows safe limit line above budget */
  surplusAmount?: number | undefined;
}

interface ChartDataPoint {
  day: number;
  date: string;
  label: string; // "Day 5" or "Jan" depending on view mode
  actualCumulative: number | null;
  expectedCumulative: number;
  actualPercent: number | null;
  expectedPercent: number;
  projectedPercent: number | null;
  dailySpend: number;
  isFuture: boolean;
}

interface TooltipPayload {
  name: string;
  value: number;
  dataKey: string;
  color: string;
  payload: ChartDataPoint;
}

function CustomTooltip({
  active,
  payload,
  totalBudget,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  totalBudget: number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  // For future days, show projection info
  if (data.isFuture) {
    const projectedTotal = totalBudget * (data.projectedPercent ?? 0) / 100;
    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <p className="mb-2 font-semibold">{data.label} <span className="font-normal text-muted-foreground">(projected)</span></p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CHART_COLORS.expense, opacity: 0.5 }}
              />
              <span>Projected Spending</span>
            </div>
            <span className="font-mono">{formatCents(projectedTotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-green-600" />
              <span>Budgeted Spending</span>
            </div>
            <span className="font-mono text-muted-foreground">{formatCents(data.expectedCumulative)}</span>
          </div>
        </div>
        <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
          Based on current spending pace
        </div>
      </div>
    );
  }

  const actualPercent = data.actualPercent ?? 0;
  const paceStatus = actualPercent > data.expectedPercent + 10
    ? 'Overspending'
    : actualPercent < data.expectedPercent - 10
      ? 'Under pace'
      : 'On track';

  const paceColor = actualPercent > data.expectedPercent + 10
    ? 'text-amber-600'
    : actualPercent < data.expectedPercent - 10
      ? 'text-green-600'
      : 'text-green-600';

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-2 font-semibold">{data.label}</p>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CHART_COLORS.expense }}
            />
            <span>Actual Spending</span>
          </div>
          <span className="font-mono">{formatCents(data.actualCumulative ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-green-600" />
            <span>Budgeted Spending</span>
          </div>
          <span className="font-mono text-muted-foreground">{formatCents(data.expectedCumulative)}</span>
        </div>
        {data.dailySpend > 0 && (
          <div className="flex items-center justify-between gap-6 text-muted-foreground">
            <span>Today&apos;s spend</span>
            <span className="font-mono">{formatCents(data.dailySpend)}</span>
          </div>
        )}
      </div>
      <div className="mt-2 border-t pt-2">
        <div className="flex justify-between gap-6 text-sm">
          <span>Budget used</span>
          <span className={`font-semibold ${paceColor}`}>
            {Math.round(actualPercent)}% ({paceStatus})
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatCents(totalBudget - (data.actualCumulative ?? 0))} remaining of {formatCents(totalBudget)}
        </div>
      </div>
    </div>
  );
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function BurnRateChart({
  dailySpending,
  totalBudget,
  periodStart,
  periodEnd,
  periodLabel: _periodLabel,
  compact = false,
  viewMode = 'month',
  surplusAmount,
}: BurnRateChartProps) {
  void _periodLabel; // Kept for API compatibility

  // Calculate safe limit percentage (budget + surplus as % of budget)
  const surplusPercent = surplusAmount && surplusAmount > 0 && totalBudget > 0
    ? (surplusAmount / totalBudget) * 100
    : 0;
  const safeLimitPercent = 100 + surplusPercent;
  const chartData = useMemo(() => {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create a map of date -> spending
    const spendingByDate: Record<string, number> = {};
    for (const item of dailySpending) {
      spendingByDate[item.date] = (spendingByDate[item.date] ?? 0) + item.amount;
    }

    // For year/quarter views, aggregate by month
    const useMonthlyAggregation = viewMode === 'year' || viewMode === 'quarter';

    if (useMonthlyAggregation) {
      // Calculate spending by month
      const monthlyData: ChartDataPoint[] = [];
      const startMonth = start.getMonth();
      const startYear = start.getFullYear();
      const endMonth = end.getMonth();
      const endYear = end.getFullYear();
      const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;

      let cumulativeSpend = 0;
      let currentMonthIndex = 0;

      for (let m = 0; m < totalMonths; m++) {
        const monthDate = new Date(startYear, startMonth + m, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = MONTH_NAMES[monthDate.getMonth()] ?? '';

        // Check if this month is in the future
        const isFuture = monthDate > today;

        if (!isFuture) {
          // Sum spending for this month
          let monthSpend = 0;
          for (const [date, amount] of Object.entries(spendingByDate)) {
            if (date.startsWith(monthKey)) {
              monthSpend += amount;
            }
          }
          cumulativeSpend += monthSpend;
          currentMonthIndex = m + 1;

          const expectedPercent = ((m + 1) / totalMonths) * 100;
          const actualPercent = totalBudget > 0 ? (cumulativeSpend / totalBudget) * 100 : 0;

          monthlyData.push({
            day: m + 1,
            date: monthKey,
            label: monthLabel,
            actualCumulative: cumulativeSpend,
            expectedCumulative: ((m + 1) / totalMonths) * totalBudget,
            actualPercent,
            expectedPercent,
            projectedPercent: actualPercent,
            dailySpend: monthSpend,
            isFuture: false,
          });
        }
      }

      // Calculate monthly burn rate for projection
      const lastActualPercent = currentMonthIndex > 0 && totalBudget > 0
        ? (cumulativeSpend / totalBudget) * 100
        : 0;
      const monthlyBurnRate = currentMonthIndex > 0 ? lastActualPercent / currentMonthIndex : 0;

      // Add future months with projection
      for (let m = currentMonthIndex; m < totalMonths; m++) {
        const monthDate = new Date(startYear, startMonth + m, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = MONTH_NAMES[monthDate.getMonth()] ?? '';

        const expectedPercent = ((m + 1) / totalMonths) * 100;
        const projectedPercent = monthlyBurnRate * (m + 1);

        monthlyData.push({
          day: m + 1,
          date: monthKey,
          label: monthLabel,
          actualCumulative: null,
          expectedCumulative: ((m + 1) / totalMonths) * totalBudget,
          actualPercent: null,
          expectedPercent,
          projectedPercent,
          dailySpend: 0,
          isFuture: true,
        });
      }

      return { data: monthlyData, totalDays: totalMonths, currentDay: currentMonthIndex };
    }

    // Daily aggregation for month view
    const data: ChartDataPoint[] = [];
    let cumulativeSpend = 0;
    let currentDay = 0;

    // First pass: calculate actual spending up to today
    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().slice(0, 10);
      const day = i + 1;
      const isFuture = currentDate > today;

      if (!isFuture) {
        const dailySpend = spendingByDate[dateStr] ?? 0;
        cumulativeSpend += dailySpend;
        currentDay = day;

        const expectedCumulative = (day / totalDays) * totalBudget;
        const actualPercent = totalBudget > 0 ? (cumulativeSpend / totalBudget) * 100 : 0;
        const expectedPercent = (day / totalDays) * 100;

        data.push({
          day,
          date: dateStr,
          label: `Day ${day}`,
          actualCumulative: cumulativeSpend,
          expectedCumulative,
          actualPercent,
          expectedPercent,
          projectedPercent: actualPercent, // At today, projection = actual
          dailySpend: dailySpend,
          isFuture: false,
        });
      }
    }

    // Calculate daily burn rate based on current pace
    const lastActualPercent = currentDay > 0 && totalBudget > 0
      ? (cumulativeSpend / totalBudget) * 100
      : 0;
    const dailyBurnRate = currentDay > 0 ? lastActualPercent / currentDay : 0;

    // Second pass: add future days with projection
    for (let i = currentDay; i < totalDays; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().slice(0, 10);
      const day = i + 1;

      const expectedCumulative = (day / totalDays) * totalBudget;
      const expectedPercent = (day / totalDays) * 100;
      // Project based on current burn rate
      const projectedPercent = dailyBurnRate * day;

      data.push({
        day,
        date: dateStr,
        label: `Day ${day}`,
        actualCumulative: null,
        expectedCumulative,
        actualPercent: null,
        expectedPercent,
        projectedPercent,
        dailySpend: 0,
        isFuture: true,
      });
    }

    return { data, totalDays, currentDay };
  }, [dailySpending, totalBudget, periodStart, periodEnd, viewMode]);

  const currentDay = chartData.currentDay;
  const lastActualDataPoint = chartData.data.find((d) => !d.isFuture && d.day === currentDay);
  const burnRate = lastActualDataPoint
    ? lastActualDataPoint.expectedPercent > 0
      ? Math.round(((lastActualDataPoint.actualPercent ?? 0) / lastActualDataPoint.expectedPercent) * 100)
      : 0
    : 0;

  if (totalBudget === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted-foreground ${compact ? 'h-24' : 'h-64'}`}>
        No budget set{compact ? '' : '. Add budget rules to track spending pace'}.
      </div>
    );
  }

  if (chartData.data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted-foreground ${compact ? 'h-24' : 'h-64'}`}>
        No spending data yet.
      </div>
    );
  }

  // Compact mode: chart with simple axis labels
  if (compact) {
    // Dynamic color based on burn rate: green (on track), amber (slightly over), red (overspending)
    const paceColor = burnRate > 100 ? '#d97706' : '#16a34a';

    return (
      <div className="w-full">
        <ResponsiveContainer width="100%" height={80}>
          <ComposedChart data={chartData.data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            {/* 100% budget line - amber for "caution/limit" threshold */}
            <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="2 2" />

            {/* Area under actual spending */}
            <Area
              type="monotone"
              dataKey="actualPercent"
              fill={paceColor}
              fillOpacity={0.15}
              stroke="none"
              connectNulls={false}
            />

            {/* Expected pace line (diagonal) */}
            <Line
              type="linear"
              dataKey="expectedPercent"
              stroke="#16a34a"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
            />

            {/* Projected spending line (future) */}
            <Line
              type="linear"
              dataKey="projectedPercent"
              stroke={paceColor}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              dot={false}
            />

            {/* Actual spending line */}
            <Line
              type="monotone"
              dataKey="actualPercent"
              stroke={paceColor}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        {/* Simple axis labels */}
        <div className="flex items-end justify-between px-1 text-[9px] text-muted-foreground">
          <span className="leading-none">0</span>
          <span className="flex-1 text-center leading-none">Time →</span>
          <span className="leading-none">Budget</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData.data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value) => `${Math.round(value)}%`}
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={45}
            domain={[0, (dataMax: number) => Math.max(safeLimitPercent, 100, Math.ceil(dataMax / 10) * 10)]}
          />
          <Tooltip content={<CustomTooltip totalBudget={totalBudget} />} />

          {/* 100% budget line - amber for "caution/limit" threshold */}
          <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="3 3" />

          {/* Safe limit line (budget + surplus) - only show if there's positive surplus */}
          {surplusPercent > 0 && (
            <ReferenceLine y={safeLimitPercent} stroke="#22c55e" strokeDasharray="6 3" />
          )}

          {/* Area under actual spending */}
          <Area
            type="monotone"
            dataKey="actualPercent"
            fill={CHART_COLORS.expense}
            fillOpacity={0.15}
            stroke="none"
            connectNulls={false}
          />

          {/* Expected pace line (diagonal) */}
          <Line
            type="linear"
            dataKey="expectedPercent"
            name="Budgeted Spending"
            stroke="#16a34a"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />

          {/* Projected spending line (future) */}
          <Line
            type="linear"
            dataKey="projectedPercent"
            name="Projected Spending"
            stroke={CHART_COLORS.expense}
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeOpacity={0.5}
            dot={false}
          />

          {/* Actual spending line */}
          <Line
            type="monotone"
            dataKey="actualPercent"
            name="Actual Spending"
            stroke={CHART_COLORS.expense}
            strokeWidth={2.5}
            dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS.expense }}
            activeDot={{ r: 6 }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-6">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-0.5 w-4" style={{ backgroundColor: CHART_COLORS.expense }} />
          <span>Actual Spending</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="h-0.5 w-4 border-t-2 border-dashed border-green-600" />
          <span>Budgeted Spending</span>
        </div>
        {currentDay < chartData.totalDays && (
          <div className="flex items-center gap-2 text-sm">
            <div className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: CHART_COLORS.expense, opacity: 0.5 }} />
            <span className="text-muted-foreground">Projected Spending</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <div className="h-0.5 w-4 border-t-2 border-dashed border-amber-500" />
          <span>Budget</span>
        </div>
        {surplusPercent > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <div className="h-0.5 w-4 border-t-2 border-dashed border-green-500" />
            <span>Safe Limit</span>
          </div>
        )}
      </div>
    </div>
  );
}
