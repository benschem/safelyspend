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

interface SavingsOverTimeChartProps {
  monthlySavings: MonthlySavings[];
}

interface TooltipPayload {
  name: string;
  value: number;
  dataKey: string;
  payload: MonthlySavings;
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

  const totalCumulative = data.cumulativeActual + data.cumulativeForecast;
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
            <span className="text-muted-foreground">Forecast this month:</span>
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
      <div className="mt-2 border-t pt-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Cumulative actual:</span>
          <span className="font-mono font-medium">{formatCents(data.cumulativeActual)}</span>
        </div>
        {data.cumulativeForecast > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">+ Forecast:</span>
            <span className="font-mono text-blue-400">+{formatCents(data.cumulativeForecast)}</span>
          </div>
        )}
        {data.cumulativeForecast > 0 && (
          <div className="flex items-center gap-2 font-medium">
            <span className="text-muted-foreground">Projected total:</span>
            <span className="font-mono">{formatCents(totalCumulative)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SavingsOverTimeChart({ monthlySavings }: SavingsOverTimeChartProps) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const hasCurrentMonth = monthlySavings.some((m) => m.month === currentMonth);

  const hasSavings = monthlySavings.some((m) => m.actual > 0 || m.forecast > 0);

  if (!hasSavings) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No savings data in this period.
      </div>
    );
  }

  // Transform data to show stacked cumulative values
  const chartData = monthlySavings.map((m) => ({
    month: m.month,
    actual: m.actual,
    forecast: m.forecast,
    cumulativeActual: m.cumulativeActual,
    cumulativeForecast: m.cumulativeForecast,
    // For stacked area, we need the total for the forecast layer
    cumulativeTotal: m.cumulativeActual + m.cumulativeForecast,
  }));

  const hasForecast = monthlySavings.some((m) => m.forecast > 0);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
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

          {hasForecast && (
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
          <Area
            type="monotone"
            dataKey="cumulativeActual"
            name="Actual Savings"
            stroke={CHART_COLORS.savings}
            strokeWidth={2}
            fill="url(#actualSavingsGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-2 flex justify-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: CHART_COLORS.savings }}
          />
          <span>Actual Savings</span>
        </div>
        {hasForecast && (
          <div className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: `${CHART_COLORS.savings}60` }}
            />
            <span>Forecast</span>
          </div>
        )}
      </div>
    </div>
  );
}
