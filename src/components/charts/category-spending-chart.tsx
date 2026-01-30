import { useMemo, useState } from 'react';
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
import type { Category } from '@/lib/types';

interface MonthlySpending {
  month: string;
  categories: Record<string, { actual: number; forecast: number }>;
  uncategorized: { actual: number; forecast: number };
  total: { actual: number; forecast: number };
}

interface CategorySpendingChartProps {
  monthlySpending: MonthlySpending[];
  usedCategories: Category[];
  colorMap: Record<string, string>;
}

interface TooltipPayload {
  name: string;
  value: number;
  dataKey: string;
  color: string;
  stroke: string;
  payload: Record<string, unknown> & { month: string };
}

function CustomTooltip({
  active,
  payload,
  label,
  colorMap,
  currentMonth,
  monthlyData,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  colorMap: Record<string, string>;
  currentMonth: string;
  monthlyData: MonthlySpending[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  // Get the raw data for this month to show actual vs forecast breakdown
  const monthData = monthlyData.find((m) => m.month === label);

  // Sort by value descending
  const sorted = [...payload]
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  if (sorted.length === 0) return null;

  const total = sorted.reduce((sum, p) => sum + p.value, 0);
  const isFuture = label && label > currentMonth;
  const isCurrent = label === currentMonth;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-2 font-semibold">
        {label ? formatMonth(label) : ''}
        {isFuture && <span className="ml-2 text-xs font-normal text-muted-foreground">(forecast)</span>}
        {isCurrent && <span className="ml-2 text-xs font-normal text-muted-foreground">(current)</span>}
      </p>
      <div className="space-y-1">
        {sorted.map((item) => {
          const catData = item.dataKey === 'uncategorized'
            ? monthData?.uncategorized
            : monthData?.categories[item.dataKey];
          const hasBreakdown = catData && catData.actual > 0 && catData.forecast > 0;

          return (
            <div key={item.dataKey}>
              <div className="flex items-center justify-between gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colorMap[item.dataKey] ?? item.stroke }}
                  />
                  <span>{item.name}</span>
                </div>
                <span className="font-mono">{formatCents(item.value)}</span>
              </div>
              {hasBreakdown && (
                <div className="ml-5 text-xs text-muted-foreground">
                  {formatCents(catData.actual)} actual + {formatCents(catData.forecast)} forecast
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between border-t pt-2 text-sm font-semibold">
        <span>Total</span>
        <span className="font-mono">{formatCents(total)}</span>
      </div>
    </div>
  );
}

export function CategorySpendingChart({
  monthlySpending,
  usedCategories,
  colorMap,
}: CategorySpendingChartProps) {
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  const currentMonth = new Date().toISOString().slice(0, 7);

  // Check if current month is in the data range
  const hasCurrentMonth = monthlySpending.some((m) => m.month === currentMonth);
  const hasFutureData = monthlySpending.some((m) => m.month > currentMonth);

  // Transform data: one line per category with total (actual + forecast)
  const chartData = useMemo(() => {
    return monthlySpending.map((month) => {
      const dataPoint: Record<string, number | string> = { month: month.month };

      for (const cat of usedCategories) {
        const catData = month.categories[cat.id];
        dataPoint[cat.id] = (catData?.actual ?? 0) + (catData?.forecast ?? 0);
      }

      const uncatTotal = month.uncategorized.actual + month.uncategorized.forecast;
      if (uncatTotal > 0) {
        dataPoint['uncategorized'] = uncatTotal;
      }

      return dataPoint;
    });
  }, [monthlySpending, usedCategories]);

  // Calculate period totals for each category (for sorting legend)
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const cat of usedCategories) {
      totals[cat.id] = monthlySpending.reduce((sum, m) => {
        const catData = m.categories[cat.id];
        return sum + (catData?.actual ?? 0) + (catData?.forecast ?? 0);
      }, 0);
    }
    totals['uncategorized'] = monthlySpending.reduce(
      (sum, m) => sum + m.uncategorized.actual + m.uncategorized.forecast,
      0,
    );
    return totals;
  }, [monthlySpending, usedCategories]);

  // Sort categories by total spending (highest first) for the legend
  const sortedCategories = useMemo(() => {
    return [...usedCategories].sort(
      (a, b) => (categoryTotals[b.id] ?? 0) - (categoryTotals[a.id] ?? 0),
    );
  }, [usedCategories, categoryTotals]);

  const hasUncategorized = (categoryTotals['uncategorized'] ?? 0) > 0;
  const hasData = monthlySpending.some((m) => m.total.actual > 0 || m.total.forecast > 0);

  const toggleCategory = (categoryId: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No spending data in this period.
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
          <Tooltip
            content={
              <CustomTooltip
                colorMap={colorMap}
                currentMonth={currentMonth}
                monthlyData={monthlySpending}
              />
            }
          />
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

          {sortedCategories.map((cat) => {
            const catColor = colorMap[cat.id] ?? '#9ca3af';
            return (
              <Line
                key={cat.id}
                type="monotone"
                dataKey={cat.id}
                name={cat.name}
                stroke={catColor}
                strokeWidth={hiddenCategories.has(cat.id) ? 0 : 2.5}
                dot={{ r: 4, strokeWidth: 0, fill: catColor }}
                activeDot={{ r: 6 }}
                hide={hiddenCategories.has(cat.id)}
              />
            );
          })}

          {hasUncategorized && (
            <Line
              type="monotone"
              dataKey="uncategorized"
              name="Uncategorised"
              stroke={CHART_COLORS.uncategorized}
              strokeWidth={hiddenCategories.has('uncategorized') ? 0 : 2.5}
              dot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.uncategorized }}
              activeDot={{ r: 6 }}
              hide={hiddenCategories.has('uncategorized')}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend Controls */}
      <div className="mt-4 flex justify-center gap-2">
        <button
          onClick={() => setHiddenCategories(new Set())}
          className="cursor-pointer rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Select All
        </button>
        <button
          onClick={() => {
            const allIds = new Set(sortedCategories.map((c) => c.id));
            if (hasUncategorized) allIds.add('uncategorized');
            setHiddenCategories(allIds);
          }}
          className="cursor-pointer rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Deselect All
        </button>
      </div>

      {/* Interactive Legend with totals */}
      <div className="mt-2 flex flex-wrap justify-center gap-x-2 gap-y-2">
        {sortedCategories.map((cat) => {
          const isHidden = hiddenCategories.has(cat.id);
          const total = categoryTotals[cat.id] ?? 0;
          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all hover:bg-muted ${
                isHidden ? 'opacity-40' : ''
              }`}
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: colorMap[cat.id] }}
              />
              <span className={isHidden ? 'line-through' : ''}>{cat.name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatCents(total)}
              </span>
            </button>
          );
        })}
        {hasUncategorized && (
          <button
            onClick={() => toggleCategory('uncategorized')}
            className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all hover:bg-muted ${
              hiddenCategories.has('uncategorized') ? 'opacity-40' : ''
            }`}
          >
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: CHART_COLORS.uncategorized }}
            />
            <span className={hiddenCategories.has('uncategorized') ? 'line-through' : ''}>
              Uncategorised
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatCents(categoryTotals['uncategorized'] ?? 0)}
            </span>
          </button>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Click categories to show/hide.
        {hasFutureData && ' Data after the "Now" line is forecast.'}
      </p>
    </div>
  );
}
