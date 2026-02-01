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
}

interface ChartDataPoint {
  day: number;
  date: string;
  actualCumulative: number;
  expectedCumulative: number;
  actualPercent: number;
  expectedPercent: number;
  dailySpend: number;
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

  const paceStatus = data.actualPercent > data.expectedPercent + 10
    ? 'Overspending'
    : data.actualPercent < data.expectedPercent - 10
      ? 'Under pace'
      : 'On track';

  const paceColor = data.actualPercent > data.expectedPercent + 10
    ? 'text-red-600'
    : data.actualPercent < data.expectedPercent - 10
      ? 'text-green-600'
      : 'text-green-600';

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-2 font-semibold">Day {data.day}</p>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CHART_COLORS.expense }}
            />
            <span>Spent</span>
          </div>
          <span className="font-mono">{formatCents(data.actualCumulative)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 rounded-full bg-gray-400"
            />
            <span>Expected</span>
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
        <div className="flex justify-between text-sm">
          <span>Budget used</span>
          <span className={`font-semibold ${paceColor}`}>
            {Math.round(data.actualPercent)}% ({paceStatus})
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatCents(totalBudget - data.actualCumulative)} remaining of {formatCents(totalBudget)}
        </div>
      </div>
    </div>
  );
}

export function BurnRateChart({
  dailySpending,
  totalBudget,
  periodStart,
  periodEnd,
  periodLabel,
  compact = false,
}: BurnRateChartProps) {
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

    const data: ChartDataPoint[] = [];
    let cumulativeSpend = 0;

    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().slice(0, 10);
      const day = i + 1;

      // Only include data up to today
      if (currentDate > today) break;

      const dailySpend = spendingByDate[dateStr] ?? 0;
      cumulativeSpend += dailySpend;

      const expectedCumulative = (day / totalDays) * totalBudget;
      const actualPercent = totalBudget > 0 ? (cumulativeSpend / totalBudget) * 100 : 0;
      const expectedPercent = (day / totalDays) * 100;

      data.push({
        day,
        date: dateStr,
        actualCumulative: cumulativeSpend,
        expectedCumulative,
        actualPercent,
        expectedPercent,
        dailySpend,
      });
    }

    return { data, totalDays };
  }, [dailySpending, totalBudget, periodStart, periodEnd]);

  const currentDay = chartData.data.length;
  const lastDataPoint = chartData.data[chartData.data.length - 1];
  const burnRate = lastDataPoint
    ? lastDataPoint.expectedPercent > 0
      ? Math.round((lastDataPoint.actualPercent / lastDataPoint.expectedPercent) * 100)
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
    const paceColor = burnRate > 120 ? '#dc2626' : burnRate > 100 ? '#d97706' : '#16a34a';

    return (
      <div className="w-full">
        <ResponsiveContainer width="100%" height={80}>
          <ComposedChart data={chartData.data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            {/* 100% budget line */}
            <ReferenceLine y={100} stroke="#e5e7eb" strokeDasharray="2 2" />

            {/* Area under actual spending */}
            <Area
              type="monotone"
              dataKey="actualPercent"
              fill={paceColor}
              fillOpacity={0.15}
              stroke="none"
            />

            {/* Expected pace line (diagonal) */}
            <Line
              type="linear"
              dataKey="expectedPercent"
              stroke="#9ca3af"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
            />

            {/* Actual spending line */}
            <Line
              type="monotone"
              dataKey="actualPercent"
              stroke={paceColor}
              strokeWidth={2}
              dot={false}
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
      {/* Summary stats */}
      <div className="mb-6 flex flex-wrap gap-6">
        <div>
          <p className="text-sm text-muted-foreground">Period</p>
          <p className="font-semibold">{periodLabel}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Day</p>
          <p className="font-semibold">{currentDay} of {chartData.totalDays}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Spent</p>
          <p className="font-semibold">{formatCents(lastDataPoint?.actualCumulative ?? 0)} of {formatCents(totalBudget)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Burn Rate</p>
          <p className={`font-semibold ${burnRate > 120 ? 'text-red-600' : burnRate > 100 ? 'text-amber-600' : 'text-green-600'}`}>
            {burnRate}% of pace
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData.data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `${value}`}
          />
          <YAxis
            tickFormatter={(value) => `${Math.round(value)}%`}
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={45}
            domain={[0, (dataMax: number) => Math.max(100, Math.ceil(dataMax / 10) * 10)]}
          />
          <Tooltip content={<CustomTooltip totalBudget={totalBudget} />} />

          {/* 100% budget line */}
          <ReferenceLine y={100} stroke="#e5e7eb" strokeDasharray="3 3" />

          {/* Area under actual spending */}
          <Area
            type="monotone"
            dataKey="actualPercent"
            fill={CHART_COLORS.expense}
            fillOpacity={0.15}
            stroke="none"
          />

          {/* Expected pace line (diagonal) */}
          <Line
            type="linear"
            dataKey="expectedPercent"
            name="Expected Pace"
            stroke="#9ca3af"
            strokeWidth={2}
            strokeDasharray="5 5"
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
          <div className="h-0.5 w-4 border-t-2 border-dashed border-gray-400" />
          <span>Expected Pace</span>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        {burnRate > 120
          ? 'Spending faster than budget allows. Consider slowing down.'
          : burnRate > 100
            ? 'Slightly ahead of pace. Monitor spending.'
            : 'On track or under pace. Keep it up!'}
      </p>
    </div>
  );
}
