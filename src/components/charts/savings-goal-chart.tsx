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

interface MonthlySavings {
  month: string;
  actual: number;
  forecast: number;
  cumulativeActual: number;
  cumulativeForecast: number;
}

interface SavingsGoalChartProps {
  goalName: string;
  targetAmount: number;
  monthlySavings: MonthlySavings[];
}

interface TooltipPayload {
  name: string;
  value: number;
  dataKey: string;
  payload: MonthlySavings & { cumulativeTotal: number };
}

function CustomTooltip({
  active,
  payload,
  label,
  targetAmount,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  targetAmount: number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const totalCumulative = data.cumulativeActual + data.cumulativeForecast;
  const percentComplete =
    targetAmount > 0 ? Math.min(100, (totalCumulative / targetAmount) * 100) : 0;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm">
      <p className="mb-2 font-medium">{label ? formatMonth(label) : ''}</p>
      <div className="space-y-1 text-sm">
        {data.actual > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">This month (actual):</span>
            <span className="font-mono text-blue-600">+{formatCents(data.actual)}</span>
          </div>
        )}
        {data.forecast > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">This month (forecast):</span>
            <span className="font-mono text-blue-400">+{formatCents(data.forecast)}</span>
          </div>
        )}
      </div>
      <div className="mt-2 border-t pt-2 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Total saved:</span>
          <span className="font-mono font-medium">{formatCents(totalCumulative)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Goal:</span>
          <span className="font-mono">{formatCents(targetAmount)}</span>
        </div>
        <div className="flex justify-between gap-4 font-medium">
          <span className="text-muted-foreground">Progress:</span>
          <span className={percentComplete >= 100 ? 'text-green-600' : ''}>
            {percentComplete.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function SavingsGoalChart({
  goalName,
  targetAmount,
  monthlySavings,
}: SavingsGoalChartProps) {
  const hasSavings = monthlySavings.some((m) => m.actual > 0 || m.forecast > 0);

  if (!hasSavings) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No savings for this goal yet.
      </div>
    );
  }

  const chartData = monthlySavings.map((m) => ({
    ...m,
    cumulativeTotal: m.cumulativeActual + m.cumulativeForecast,
  }));

  const hasForecast = monthlySavings.some((m) => m.forecast > 0);
  const finalTotal = chartData[chartData.length - 1]?.cumulativeTotal ?? 0;
  const percentComplete = targetAmount > 0 ? Math.min(100, (finalTotal / targetAmount) * 100) : 0;

  // Determine Y-axis max to show target line properly
  const maxValue = Math.max(targetAmount, ...chartData.map((d) => d.cumulativeTotal));

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">{goalName}</h3>
        <div className="text-right text-sm">
          <span className="font-mono font-medium">{formatCents(finalTotal)}</span>
          <span className="text-muted-foreground"> of </span>
          <span className="font-mono text-muted-foreground">{formatCents(targetAmount)}</span>
          <span className="ml-2 text-muted-foreground">({percentComplete.toFixed(0)}%)</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <defs>
            <linearGradient id={`goalActual-${goalName}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.savings} stopOpacity={0.4} />
              <stop offset="95%" stopColor={CHART_COLORS.savings} stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id={`goalForecast-${goalName}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.savings} stopOpacity={0.2} />
              <stop offset="95%" stopColor={CHART_COLORS.savings} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            tickFormatter={(value) => formatMonth(value)}
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value) => formatCentsShort(value)}
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={45}
            domain={[0, maxValue * 1.1]}
          />
          <Tooltip content={<CustomTooltip targetAmount={targetAmount} />} />

          {/* Target line */}
          <ReferenceLine
            y={targetAmount}
            stroke="#22c55e"
            strokeDasharray="4 4"
            strokeWidth={2}
            label={{
              value: 'Goal',
              position: 'right',
              fontSize: 10,
              fill: '#22c55e',
            }}
          />

          {hasForecast && (
            <Area
              type="monotone"
              dataKey="cumulativeTotal"
              name="Projected Total"
              stroke={`${CHART_COLORS.savings}60`}
              strokeWidth={2}
              strokeDasharray="4 4"
              fill={`url(#goalForecast-${goalName})`}
            />
          )}
          <Area
            type="monotone"
            dataKey="cumulativeActual"
            name="Actual Savings"
            stroke={CHART_COLORS.savings}
            strokeWidth={2}
            fill={`url(#goalActual-${goalName})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
