import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatCents, formatCentsShort, formatMonth } from '@/lib/utils';
import { CHART_COLORS } from '@/lib/chart-colors';

// Budget status colors
const STATUS_COLORS = {
  under: '#22c55e', // green-500
  close: '#f59e0b', // amber-500
  over: '#ef4444', // red-500
  noBudget: '#6b7280', // gray-500
};

interface MonthlyData {
  month: string;
  actual: number;
}

interface CategoryMonthlyChartProps {
  monthlyData: MonthlyData[];
  monthlyBudget: number | null;
  currentMonth: string;
}

interface ChartDataPoint {
  month: string;
  actual: number;
  remaining: number;
  budget: number | null;
  isCurrentMonth: boolean;
  budgetPercent: number | null;
}

interface TooltipPayload {
  name: string;
  value: number;
  dataKey: string;
  color: string;
  payload: ChartDataPoint;
}

function getBudgetStatusColor(percent: number | null, isFaded: boolean): string {
  if (percent === null) {
    return isFaded ? `${STATUS_COLORS.noBudget}60` : STATUS_COLORS.noBudget;
  }

  let baseColor: string;
  if (percent > 100) {
    baseColor = STATUS_COLORS.over;
  } else if (percent >= 80) {
    baseColor = STATUS_COLORS.close;
  } else {
    baseColor = STATUS_COLORS.under;
  }

  return isFaded ? `${baseColor}70` : baseColor;
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

  const statusColor = getBudgetStatusColor(data.budgetPercent, false);

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-2 font-semibold">
        {label ? formatMonth(label) : ''}
        {data.isCurrentMonth && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">(current)</span>
        )}
      </p>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 rounded"
              style={{ backgroundColor: statusColor }}
            />
            <span>Spent</span>
          </div>
          <span className="font-mono">{formatCents(data.actual)}</span>
        </div>
        {data.isCurrentMonth && data.remaining > 0 && (
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded opacity-40"
                style={{ backgroundColor: statusColor }}
              />
              <span>Remaining</span>
            </div>
            <span className="font-mono">{formatCents(data.remaining)}</span>
          </div>
        )}
        {data.budget !== null && (
          <>
            <div className="flex items-center justify-between gap-6 text-muted-foreground">
              <span>Budget</span>
              <span className="font-mono">{formatCents(data.budget)}</span>
            </div>
            <div className="border-t pt-1 mt-1">
              <div className="flex justify-between font-medium" style={{ color: statusColor }}>
                <span>{data.actual > data.budget ? 'Over' : 'Under'}</span>
                <span className="font-mono">{formatCents(Math.abs(data.budget - data.actual))}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function CategoryMonthlyChart({ monthlyData, monthlyBudget, currentMonth }: CategoryMonthlyChartProps) {
  const chartData: ChartDataPoint[] = useMemo(() => {
    return monthlyData.map((m) => {
      const isCurrentMonth = m.month === currentMonth;
      const budgetPercent = monthlyBudget && monthlyBudget > 0
        ? Math.round((m.actual / monthlyBudget) * 100)
        : null;

      // For current month, show remaining budget as separate segment
      const remaining = isCurrentMonth && monthlyBudget
        ? Math.max(0, monthlyBudget - m.actual)
        : 0;

      return {
        month: m.month,
        actual: m.actual,
        remaining,
        budget: monthlyBudget,
        isCurrentMonth,
        budgetPercent,
      };
    });
  }, [monthlyData, monthlyBudget, currentMonth]);

  const hasData = monthlyData.some((m) => m.actual > 0) || monthlyBudget !== null;

  if (!hasData) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No spending data in this period.
      </div>
    );
  }

  // Calculate Y-axis max to ensure budget line is visible
  const maxValue = Math.max(
    ...monthlyData.map((m) => m.actual),
    monthlyBudget ?? 0,
  );
  const yAxisMax = Math.ceil(maxValue * 1.1 / 10000) * 10000 || 10000;

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <XAxis
            dataKey="month"
            tickFormatter={(value: string) => formatMonth(value).split(' ')[0] ?? ''}
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value) => formatCentsShort(value)}
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={45}
            domain={[0, yAxisMax]}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Budget line (dashed) */}
          {monthlyBudget !== null && (
            <Line
              type="monotone"
              dataKey="budget"
              name="Budget"
              stroke={CHART_COLORS.budget}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={false}
            />
          )}

          {/* Actual spending bars */}
          <Bar
            dataKey="actual"
            name="Spent"
            stackId="spending"
            maxBarSize={40}
          >
            {chartData.map((entry, index) => {
              const isFaded = !entry.isCurrentMonth;
              const color = getBudgetStatusColor(entry.budgetPercent, isFaded);
              return (
                <Cell
                  key={`actual-${index}`}
                  fill={color}
                />
              );
            })}
          </Bar>

          {/* Remaining budget (only shows for current month) */}
          <Bar
            dataKey="remaining"
            name="Remaining"
            stackId="spending"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          >
            {chartData.map((entry, index) => {
              const color = getBudgetStatusColor(entry.budgetPercent, false);
              return (
                <Cell
                  key={`remaining-${index}`}
                  fill={`${color}30`}
                  stroke={color}
                  strokeWidth={1}
                  strokeDasharray="3 2"
                />
              );
            })}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {monthlyBudget !== null ? (
          <>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: STATUS_COLORS.under }} />
              <span>Under budget</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: STATUS_COLORS.close }} />
              <span>Close</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: STATUS_COLORS.over }} />
              <span>Over</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded border border-dashed"
                style={{ borderColor: STATUS_COLORS.under, backgroundColor: `${STATUS_COLORS.under}30` }}
              />
              <span>Remaining</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded" style={{ backgroundColor: STATUS_COLORS.noBudget }} />
            <span>Spent (no budget set)</span>
          </div>
        )}
      </div>
    </div>
  );
}
