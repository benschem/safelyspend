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
  ReferenceArea,
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
  /** Expected income for the period (in cents) — green zone between budget and income, red above */
  income?: number | undefined;
  /** Fixed expense schedule from forecast rules — enables smart projection */
  fixedExpenseSchedule?: { date: string; amount: number }[];
  /** Variable budget total (budget rules only) */
  variableBudget?: number;
  /** Total fixed expenses for the period */
  fixedExpensesTotal?: number;
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
  referenceAmount,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  totalBudget: number;
  referenceAmount: number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  // For future days, show projection info
  if (data.isFuture) {
    const projectedTotal = (referenceAmount * (data.projectedPercent ?? 0)) / 100;
    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <p className="mb-2 font-semibold">
          {data.label} <span className="font-normal text-muted-foreground">(projected)</span>
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CHART_COLORS.expense, opacity: 0.5 }}
              />
              <span>Projected Spending*</span>
            </div>
            <span className="font-mono">{formatCents(projectedTotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-orange-600" />
              <span>Budgeted Spending</span>
            </div>
            <span className="font-mono text-muted-foreground">
              {formatCents(data.expectedCumulative)}
            </span>
          </div>
        </div>
        <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
          *Based on current spending pace
        </div>
      </div>
    );
  }

  const budgetUsedPercent = totalBudget > 0 ? Math.round(((data.actualCumulative ?? 0) / totalBudget) * 100) : 0;
  const paceStatus =
    budgetUsedPercent > 100
      ? 'Over budget'
      : (data.actualCumulative ?? 0) > data.expectedCumulative * 1.1
        ? 'Overspending'
        : (data.actualCumulative ?? 0) < data.expectedCumulative * 0.9
          ? 'Under pace'
          : 'On track';

  const paceColor =
    paceStatus === 'Over budget' || paceStatus === 'Overspending'
      ? 'text-orange-600'
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
            <div className="h-2.5 w-2.5 rounded-full bg-orange-600" />
            <span>Budgeted Spending</span>
          </div>
          <span className="font-mono text-muted-foreground">
            {formatCents(data.expectedCumulative)}
          </span>
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
            {budgetUsedPercent}% ({paceStatus})
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatCents(totalBudget - (data.actualCumulative ?? 0))} remaining of{' '}
          {formatCents(totalBudget)}
        </div>
      </div>
    </div>
  );
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function BurnRateChart({
  dailySpending,
  totalBudget,
  periodStart,
  periodEnd,
  periodLabel: _periodLabel,
  compact = false,
  viewMode = 'month',
  income,
  fixedExpenseSchedule,
  variableBudget,
  fixedExpensesTotal,
}: BurnRateChartProps) {
  void _periodLabel; // Kept for API compatibility
  const hasSmartProjection = fixedExpenseSchedule != null && variableBudget != null && fixedExpensesTotal != null;

  // 100% = income; budget as % of income
  const referenceAmount = income != null && income > 0 ? income : totalBudget;
  const budgetPercent = referenceAmount > 0 ? (totalBudget / referenceAmount) * 100 : 100;
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

          const expectedPercent = referenceAmount > 0 ? (((m + 1) / totalMonths) * totalBudget / referenceAmount) * 100 : 0;
          const actualPercent = referenceAmount > 0 ? (cumulativeSpend / referenceAmount) * 100 : 0;

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
      const lastActualPercent =
        currentMonthIndex > 0 && referenceAmount > 0 ? (cumulativeSpend / referenceAmount) * 100 : 0;
      const monthlyBurnRate = currentMonthIndex > 0 ? lastActualPercent / currentMonthIndex : 0;

      // Add future months with projection
      for (let m = currentMonthIndex; m < totalMonths; m++) {
        const monthDate = new Date(startYear, startMonth + m, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = MONTH_NAMES[monthDate.getMonth()] ?? '';

        const expectedPercent = referenceAmount > 0 ? (((m + 1) / totalMonths) * totalBudget / referenceAmount) * 100 : 0;
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

    // Pre-compute cumulative fixed expenses by day for smart projection
    const fixedByDate: Record<string, number> = {};
    if (hasSmartProjection) {
      for (const item of fixedExpenseSchedule!) {
        fixedByDate[item.date] = (fixedByDate[item.date] ?? 0) + item.amount;
      }
    }

    // Helper: cumulative fixed expenses up to and including a date string
    const cumulativeFixedByDay = (dateStr: string): number => {
      if (!hasSmartProjection) return 0;
      let sum = 0;
      for (const item of fixedExpenseSchedule!) {
        if (item.date <= dateStr) sum += item.amount;
      }
      return sum;
    };

    // Helper: expected cumulative at a given day (smart or linear)
    const expectedAtDay = (day: number, dateStr: string): number => {
      if (hasSmartProjection) {
        return cumulativeFixedByDay(dateStr) + (day / totalDays) * variableBudget!;
      }
      return (day / totalDays) * totalBudget;
    };

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

        const expectedCumulative = expectedAtDay(day, dateStr);
        const actualPercent = referenceAmount > 0 ? (cumulativeSpend / referenceAmount) * 100 : 0;
        const expectedPercent = referenceAmount > 0 ? (expectedCumulative / referenceAmount) * 100 : 0;

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

    // Calculate projection for future days
    let variableDailyRate: number;
    if (hasSmartProjection && currentDay > 0) {
      // Smart: only project variable spending linearly
      const fixedDueToDate = cumulativeFixedByDay(
        data[data.length - 1]?.date ?? periodStart,
      );
      const variableSpent = Math.max(0, cumulativeSpend - fixedDueToDate);
      variableDailyRate = variableSpent / currentDay;
    } else {
      variableDailyRate = 0;
    }

    // Fallback: naive linear burn rate
    const lastActualPercent =
      currentDay > 0 && referenceAmount > 0 ? (cumulativeSpend / referenceAmount) * 100 : 0;
    const dailyBurnRate = currentDay > 0 ? lastActualPercent / currentDay : 0;

    // Second pass: add future days with projection
    for (let i = currentDay; i < totalDays; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().slice(0, 10);
      const day = i + 1;

      const expectedCumulative = expectedAtDay(day, dateStr);
      const expectedPercent = referenceAmount > 0 ? (expectedCumulative / referenceAmount) * 100 : 0;

      let projectedPercent: number;
      if (hasSmartProjection) {
        // Smart: future fixed expenses on schedule + variable at current pace
        const futureCumulativeFixed = cumulativeFixedByDay(dateStr);
        const projectedCumulative = futureCumulativeFixed + variableDailyRate * day;
        projectedPercent = referenceAmount > 0 ? (projectedCumulative / referenceAmount) * 100 : 0;
      } else {
        projectedPercent = dailyBurnRate * day;
      }

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
  }, [dailySpending, totalBudget, referenceAmount, periodStart, periodEnd, viewMode, hasSmartProjection, fixedExpenseSchedule, variableBudget]);

  const currentDay = chartData.currentDay;
  if (totalBudget === 0) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-muted-foreground ${compact ? 'h-24' : 'h-64'}`}
      >
        No budget set{compact ? '' : '. Add budget rules to track spending pace'}.
      </div>
    );
  }

  if (chartData.data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-muted-foreground ${compact ? 'h-24' : 'h-64'}`}
      >
        No spending data yet.
      </div>
    );
  }

  // Compact mode: chart with simple axis labels
  if (compact) {
    // Dynamic color based on burn rate: green (on track), orange (slightly over), red (overspending)
    const paceColor = '#ea580c';

    return (
      <div className="flex h-full w-full flex-col rounded-lg bg-muted/40 px-4 pt-3 pb-2">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Spending Pace
        </p>
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData.data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Tooltip content={<CustomTooltip totalBudget={totalBudget} referenceAmount={referenceAmount} />} />
              <XAxis hide dataKey="day" type="number" domain={['dataMin', 'dataMax']} />

              {/* "Now" line */}
              {currentDay > 0 && currentDay < chartData.totalDays && (
                <ReferenceLine
                  x={currentDay}
                  stroke="#6b7280"
                  strokeWidth={1.5}
                  label={{
                    value: 'Now',
                    position: 'top',
                    fontSize: 9,
                    fill: '#6b7280',
                  }}
                />
              )}

              {(() => {
                const dataMax = Math.max(
                  ...chartData.data.map((d) => Math.max(d.actualPercent ?? 0, d.projectedPercent ?? 0, d.expectedPercent)),
                );
                const isInTheRed = dataMax > 100;
                const chartMax = isInTheRed ? dataMax + 10 : 100;
                return (
                  <>
                    <YAxis hide domain={[0, chartMax]} />
                    {/* Budget zone (0 to budget%) */}
                    <ReferenceArea y1={0} y2={budgetPercent} fill="#f97316" fillOpacity={0.2} stroke="none" />
                    {/* Income surplus zone (budget% to 100%) */}
                    {budgetPercent < 100 && (
                      <ReferenceArea y1={budgetPercent} y2={100} fill="#22c55e" fillOpacity={0.2} stroke="none" />
                    )}
                    {/* Danger zone - spending exceeds income */}
                    {isInTheRed && (
                      <ReferenceArea y1={100} y2={chartMax} fill="#ef4444" fillOpacity={0.2} stroke="none" />
                    )}
                  </>
                );
              })()}

              {/* Area under actual spending */}
              <Area
                type="monotone"
                dataKey="actualPercent"
                fill={paceColor}
                fillOpacity={0.12}
                stroke="none"
                connectNulls={false}
              />

              {/* Expected pace line (diagonal) */}
              <Line
                type="linear"
                dataKey="expectedPercent"
                stroke="#ea580c"
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
        </div>
        {/* Simple axis labels */}
        <div className="flex items-end justify-between px-1 pt-1 text-[9px] text-muted-foreground/70">
          <span className="leading-none">0</span>
          <span className="flex-1 text-center leading-none">Time →</span>
          <span className="leading-none">Spending</span>
        </div>
      </div>
    );
  }

  // Pre-compute danger zone for full chart
  const dataMax = Math.max(
    ...chartData.data.map((d) => Math.max(d.actualPercent ?? 0, d.projectedPercent ?? 0, d.expectedPercent)),
  );
  const isInTheRed = dataMax > 100;
  const chartMax = isInTheRed
    ? Math.ceil((dataMax + 10) / 10) * 10
    : 100;

  // Y-axis: convert internal percent to dollar amounts
  const maxDollarValue = (chartMax / 100) * referenceAmount / 100;
  const formatAxisDollar = (percentValue: number): string => {
    const dollars = (percentValue / 100) * referenceAmount / 100;
    if (maxDollarValue >= 1_000_000) {
      const m = dollars / 1_000_000;
      return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
    }
    if (maxDollarValue >= 10_000) {
      const k = dollars / 1_000;
      return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
    }
    if (maxDollarValue < 100) {
      return dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
    }
    return `$${Math.round(dollars).toLocaleString()}`;
  };
  const maxLabel = formatAxisDollar(chartMax);
  const yAxisWidth = Math.max(40, maxLabel.length * 8 + 8);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData.data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={formatAxisDollar}
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={yAxisWidth}
            domain={[0, chartMax]}
          />
          <Tooltip content={<CustomTooltip totalBudget={totalBudget} referenceAmount={referenceAmount} />} />

          {/* Budget zone (0 to budget%) */}
          <ReferenceArea y1={0} y2={budgetPercent} fill="#f97316" fillOpacity={0.08} stroke="none" />
          {/* Income surplus zone (budget% to 100%) */}
          {budgetPercent < 100 && (
            <ReferenceArea y1={budgetPercent} y2={100} fill="#22c55e" fillOpacity={0.08} stroke="none" />
          )}
          {/* Danger zone — spending exceeds income */}
          {isInTheRed && (
            <ReferenceArea y1={100} y2={chartMax} fill="#ef4444" fillOpacity={0.08} stroke="none" />
          )}

          {/* Budget line */}
          {budgetPercent < 100 && (
            <ReferenceLine y={budgetPercent} stroke="#f97316" strokeDasharray="3 3" />
          )}

          {/* 100% income line */}
          <ReferenceLine y={100} stroke="#22c55e" strokeDasharray="6 3" />

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
            stroke="#ea580c"
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
          <div className="h-0.5 w-4 border-t-2 border-dashed border-orange-600" />
          <span>Budgeted Spending</span>
        </div>
        {currentDay < chartData.totalDays && (
          <div className="flex items-center gap-2 text-sm">
            <div
              className="h-0.5 w-4 border-t-2 border-dashed"
              style={{ borderColor: CHART_COLORS.expense, opacity: 0.5 }}
            />
            <span className="text-muted-foreground">Projected Spending</span>
          </div>
        )}
        {budgetPercent < 100 && (
          <div className="flex items-center gap-2 text-sm">
            <div className="h-0.5 w-4 border-t-2 border-dashed border-orange-500" />
            <span>Budget</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <div className="h-0.5 w-4 border-t-2 border-dashed border-green-500" />
          <span>Income</span>
        </div>
      </div>
    </div>
  );
}
