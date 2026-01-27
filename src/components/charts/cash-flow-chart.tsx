import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { formatCents, formatCentsShort, formatMonth } from '@/lib/utils';
import { CHART_COLORS } from '@/lib/chart-colors';

interface MonthlyNetFlow {
  month: string;
  income: { actual: number; forecast: number };
  expenses: { actual: number; forecast: number };
  savings: { actual: number; forecast: number };
  net: { actual: number; forecast: number };
}

interface CashFlowChartProps {
  monthlyNetFlow: MonthlyNetFlow[];
}

interface ChartDataPoint {
  month: string;
  incomeTotal: number;
  expensesTotal: number;
  savingsTotal: number;
  incomeActual: number;
  expenseActual: number;
  savingsActual: number;
  incomeForecast: number;
  expenseForecast: number;
  savingsForecast: number;
  netActual: number;
  netForecast: number;
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
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const hasForecast = data.incomeForecast > 0 || data.expenseForecast > 0 || data.savingsForecast > 0;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-2 font-semibold">{label ? formatMonth(label) : ''}</p>
      <div className="space-y-2 text-sm">
        {/* Income */}
        <div>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CHART_COLORS.income }}
              />
              <span>Income</span>
            </div>
            <span className="font-mono text-green-600">+{formatCents(data.incomeTotal)}</span>
          </div>
          {hasForecast && data.incomeForecast > 0 && (
            <div className="ml-4 text-xs text-muted-foreground">
              {formatCents(data.incomeActual)} actual + {formatCents(data.incomeForecast)} forecast
            </div>
          )}
        </div>

        {/* Expenses */}
        <div>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CHART_COLORS.expense }}
              />
              <span>Expenses</span>
            </div>
            <span className="font-mono text-red-600">-{formatCents(data.expensesTotal)}</span>
          </div>
          {hasForecast && data.expenseForecast > 0 && (
            <div className="ml-4 text-xs text-muted-foreground">
              {formatCents(data.expenseActual)} actual + {formatCents(data.expenseForecast)} forecast
            </div>
          )}
        </div>

        {/* Savings */}
        <div>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CHART_COLORS.savings }}
              />
              <span>Savings</span>
            </div>
            <span className="font-mono text-blue-600">-{formatCents(data.savingsTotal)}</span>
          </div>
          {hasForecast && data.savingsForecast > 0 && (
            <div className="ml-4 text-xs text-muted-foreground">
              {formatCents(data.savingsActual)} actual + {formatCents(data.savingsForecast)} forecast
            </div>
          )}
        </div>
      </div>

      {/* Net */}
      <div className="mt-2 border-t pt-2">
        <div
          className={`flex justify-between text-sm font-semibold ${
            data.netActual + data.netForecast >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          <span>Net</span>
          <span className="font-mono">
            {data.netActual + data.netForecast >= 0 ? '+' : ''}
            {formatCents(data.netActual + data.netForecast)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CashFlowChart({ monthlyNetFlow }: CashFlowChartProps) {
  // Transform data for chart - combine actual + forecast for total line values
  const chartData = useMemo(() => {
    return monthlyNetFlow.map((m) => ({
      month: m.month,
      incomeTotal: m.income.actual + m.income.forecast,
      expensesTotal: m.expenses.actual + m.expenses.forecast,
      savingsTotal: m.savings.actual + m.savings.forecast,
      incomeActual: m.income.actual,
      expenseActual: m.expenses.actual,
      savingsActual: m.savings.actual,
      incomeForecast: m.income.forecast,
      expenseForecast: m.expenses.forecast,
      savingsForecast: m.savings.forecast,
      netActual: m.net.actual,
      netForecast: m.net.forecast,
    }));
  }, [monthlyNetFlow]);

  const hasData = monthlyNetFlow.some(
    (m) => m.income.actual > 0 || m.expenses.actual > 0 || m.income.forecast > 0 || m.expenses.forecast > 0,
  );

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No transaction data in this period.
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
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
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#e5e7eb" />

          <Line
            type="monotone"
            dataKey="incomeTotal"
            name="Income"
            stroke={CHART_COLORS.income}
            strokeWidth={2.5}
            dot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.income }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="expensesTotal"
            name="Expenses"
            stroke={CHART_COLORS.expense}
            strokeWidth={2.5}
            dot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.expense }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="savingsTotal"
            name="Savings"
            stroke={CHART_COLORS.savings}
            strokeWidth={2.5}
            dot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.savings }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS.income }} />
          <span>Income</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS.expense }} />
          <span>Expenses</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS.savings }} />
          <span>Savings</span>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Totals include forecasted amounts. Hover for breakdown.
      </p>
    </div>
  );
}
