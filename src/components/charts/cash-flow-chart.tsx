import { useMemo, useState } from 'react';
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
import { formatCents, formatCentsShort, formatMonth } from '@/lib/utils';
import { CHART_COLORS } from '@/lib/chart-colors';

type LegendKey = 'income' | 'expenses' | 'savings' | 'totalSaved' | 'balance';

interface MonthlyNetFlow {
  month: string;
  income: { actual: number; forecast: number };
  expenses: { actual: number; forecast: number };
  savings: { actual: number; forecast: number };
  interest: number; // Interest earned (included in total saved, not savings line)
  net: { actual: number; forecast: number };
}

interface CashFlowChartProps {
  monthlyNetFlow: MonthlyNetFlow[];
  startingBalance?: number | null; // Balance at start of period (from anchor)
  balanceStartMonth?: string | null; // Month to start showing balance (if anchor is mid-range)
  savingsStartingBalance?: number; // Total savings balance at start of period (from savings anchors)
  savingsBalanceStartMonth?: string | null; // Month to start showing savings balance (if anchor is mid-range)
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
  cumulativeSavings: number;
  balance: number | null; // Running bank balance at end of month
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
        {/* Earned */}
        <div>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CHART_COLORS.income }}
              />
              <span>Earned</span>
            </div>
            <span className="font-mono text-green-600">+{formatCents(data.incomeTotal)}</span>
          </div>
          {hasForecast && data.incomeForecast > 0 && (
            <div className="ml-4 text-xs text-muted-foreground">
              {formatCents(data.incomeActual)} actual + {formatCents(data.incomeForecast)} expected
            </div>
          )}
        </div>

        {/* Spent */}
        <div>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CHART_COLORS.expense }}
              />
              <span>Spent</span>
            </div>
            <span className="font-mono text-red-600">-{formatCents(data.expensesTotal)}</span>
          </div>
          {hasForecast && data.expenseForecast > 0 && (
            <div className="ml-4 text-xs text-muted-foreground">
              {formatCents(data.expenseActual)} actual + {formatCents(data.expenseForecast)} expected
            </div>
          )}
        </div>

        {/* Saved */}
        <div>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CHART_COLORS.savings }}
              />
              <span>Saved</span>
            </div>
            <span className="font-mono text-blue-600">-{formatCents(data.savingsTotal)}</span>
          </div>
          {hasForecast && data.savingsForecast > 0 && (
            <div className="ml-4 text-xs text-muted-foreground">
              {formatCents(data.savingsActual)} actual + {formatCents(data.savingsForecast)} expected
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

      {/* Cumulative totals */}
      {(data.cumulativeSavings > 0 || data.balance !== null) && (
        <div className="mt-2 border-t pt-2 space-y-1">
          {data.cumulativeSavings > 0 && (
            <div className="flex justify-between text-sm text-blue-600">
              <span>Total Saved</span>
              <span className="font-mono font-semibold">{formatCents(data.cumulativeSavings)}</span>
            </div>
          )}
          {data.balance !== null && (
            <div className={`flex justify-between text-sm ${data.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <span>Cash</span>
              <span className="font-mono font-semibold">{formatCents(data.balance)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CashFlowChart({ monthlyNetFlow, startingBalance, balanceStartMonth, savingsStartingBalance = 0, savingsBalanceStartMonth }: CashFlowChartProps) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const hasCurrentMonth = monthlyNetFlow.some((m) => m.month === currentMonth);
  const hasFutureData = monthlyNetFlow.some((m) => m.month > currentMonth);

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

  // Transform data for chart - combine actual + forecast for total line values
  const chartData = useMemo(() => {
    let cumulativeSavings = 0;
    let runningBalance: number | null = null;
    let balanceStarted = false;
    let savingsBalanceStarted = false;

    return monthlyNetFlow.map((m) => {
      // Cumulative savings includes contributions + interest
      const monthSavings = m.savings.actual + m.savings.forecast + m.interest;
      const netTotal = m.net.actual + m.net.forecast;

      // Start tracking savings balance from the anchor month (or from start if no savingsBalanceStartMonth)
      if (!savingsBalanceStarted && savingsStartingBalance > 0) {
        if (!savingsBalanceStartMonth || m.month >= savingsBalanceStartMonth) {
          cumulativeSavings = savingsStartingBalance;
          savingsBalanceStarted = true;
        }
      }

      // Add this month's savings if we've started tracking
      if (savingsBalanceStarted) {
        cumulativeSavings += monthSavings;
      }

      // Start tracking balance from the anchor month (or from start if no balanceStartMonth)
      if (!balanceStarted && startingBalance !== null && startingBalance !== undefined) {
        if (!balanceStartMonth || m.month >= balanceStartMonth) {
          runningBalance = startingBalance;
          balanceStarted = true;
        }
      }

      // Update running balance if we've started tracking
      if (runningBalance !== null) {
        runningBalance += netTotal;
      }

      return {
        month: m.month,
        incomeTotal: m.income.actual + m.income.forecast,
        expensesTotal: m.expenses.actual + m.expenses.forecast,
        // Savings line = contributions only (not interest)
        savingsTotal: m.savings.actual + m.savings.forecast,
        incomeActual: m.income.actual,
        expenseActual: m.expenses.actual,
        savingsActual: m.savings.actual,
        incomeForecast: m.income.forecast,
        expenseForecast: m.expenses.forecast,
        savingsForecast: m.savings.forecast,
        netActual: m.net.actual,
        netForecast: m.net.forecast,
        // Total saved includes interest and starting balance
        cumulativeSavings: savingsBalanceStarted ? cumulativeSavings : 0,
        balance: runningBalance,
      };
    });
  }, [monthlyNetFlow, startingBalance, balanceStartMonth, savingsStartingBalance, savingsBalanceStartMonth]);

  const hasBalance = startingBalance !== null && startingBalance !== undefined;

  const hasData = monthlyNetFlow.some(
    (m) => m.income.actual > 0 || m.expenses.actual > 0 || m.income.forecast > 0 || m.expenses.forecast > 0,
  );

  // Check if all legend items are hidden
  const allHidden =
    hiddenLegends.has('income') &&
    hiddenLegends.has('expenses') &&
    hiddenLegends.has('savings') &&
    hiddenLegends.has('totalSaved') &&
    (!hasBalance || hiddenLegends.has('balance'));

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No transaction data in this period.
      </div>
    );
  }

  return (
    <div className="w-full">
      {allHidden ? (
        <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
          All data hidden. Click a legend item to show it.
        </div>
      ) : (
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 55, bottom: 20, left: 20 }}>
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

          {/* Cash area in background (green) */}
          {hasBalance && !hiddenLegends.has('balance') && (
            <Area
              type="monotone"
              dataKey="balance"
              name="Cash"
              fill={CHART_COLORS.income}
              fillOpacity={0.12}
              stroke={CHART_COLORS.income}
              strokeWidth={1.5}
              strokeOpacity={0.4}
            />
          )}

          {/* Cumulative savings area (blue) */}
          {!hiddenLegends.has('totalSaved') && (
            <Area
              type="monotone"
              dataKey="cumulativeSavings"
              name="Total Saved"
              fill={CHART_COLORS.savings}
              fillOpacity={0.15}
              stroke="none"
            />
          )}

          {!hiddenLegends.has('income') && (
            <Line
              type="monotone"
              dataKey="incomeTotal"
              name="Income"
              stroke={CHART_COLORS.income}
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.income }}
              activeDot={{ r: 6 }}
            />
          )}
          {!hiddenLegends.has('expenses') && (
            <Line
              type="monotone"
              dataKey="expensesTotal"
              name="Expenses"
              stroke={CHART_COLORS.expense}
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.expense }}
              activeDot={{ r: 6 }}
            />
          )}
          {!hiddenLegends.has('savings') && (
            <Line
              type="monotone"
              dataKey="savingsTotal"
              name="Savings"
              stroke={CHART_COLORS.savings}
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.savings }}
              activeDot={{ r: 6 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => toggleLegend('income')}
          className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-all hover:bg-muted ${
            hiddenLegends.has('income') ? 'opacity-40' : ''
          }`}
        >
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.income }} />
          <span className={hiddenLegends.has('income') ? 'line-through' : ''}>Earned</span>
        </button>
        <button
          type="button"
          onClick={() => toggleLegend('expenses')}
          className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-all hover:bg-muted ${
            hiddenLegends.has('expenses') ? 'opacity-40' : ''
          }`}
        >
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.expense }} />
          <span className={hiddenLegends.has('expenses') ? 'line-through' : ''}>Spending</span>
        </button>
        <button
          type="button"
          onClick={() => toggleLegend('savings')}
          className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-all hover:bg-muted ${
            hiddenLegends.has('savings') ? 'opacity-40' : ''
          }`}
        >
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.savings }} />
          <span className={hiddenLegends.has('savings') ? 'line-through' : ''}>Saved</span>
        </button>
        <button
          type="button"
          onClick={() => toggleLegend('totalSaved')}
          className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-all hover:bg-muted ${
            hiddenLegends.has('totalSaved') ? 'opacity-40' : ''
          }`}
        >
          <div
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: CHART_COLORS.savings, opacity: 0.3 }}
          />
          <span className={hiddenLegends.has('totalSaved') ? 'line-through' : ''}>Total Saved</span>
        </button>
        {hasBalance && (
          <button
            type="button"
            onClick={() => toggleLegend('balance')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-all hover:bg-muted ${
              hiddenLegends.has('balance') ? 'opacity-40' : ''
            }`}
          >
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: CHART_COLORS.income, opacity: 0.25 }}
            />
            <span className={hiddenLegends.has('balance') ? 'line-through' : ''}>Cash</span>
          </button>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        {hasFutureData
          ? 'Data after the "Now" line is expected. Hover for breakdown.'
          : 'Hover for breakdown.'}
      </p>
    </div>
  );
}
