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
import type { Category } from '@/lib/types';

interface MonthlyBudgetComparison {
  month: string;
  categories: Record<string, { budgeted: number; actual: number }>;
}

interface BudgetComparisonChartProps {
  monthlyBudgetComparison: MonthlyBudgetComparison[];
  budgetCategories: Category[];
  colorMap: Record<string, string>;
}

interface TooltipPayload {
  name: string;
  value: number;
  dataKey: string;
  stroke: string;
  payload: Record<string, unknown>;
}

function CustomTooltip({
  active,
  payload,
  label,
  budgetCategories,
  colorMap,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  budgetCategories: Category[];
  colorMap: Record<string, string>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  // Build category comparison data
  const comparisons: Array<{
    name: string;
    actual: number;
    budget: number;
    variance: number;
    color: string;
  }> = [];

  budgetCategories.forEach((cat) => {
    const actual = (data[`${cat.id}_actual`] as number) ?? 0;
    const budget = (data[`${cat.id}_budget`] as number) ?? 0;
    if (actual > 0 || budget > 0) {
      comparisons.push({
        name: cat.name,
        actual,
        budget,
        variance: budget - actual,
        color: colorMap[cat.id] ?? '#9ca3af',
      });
    }
  });

  // Sort by variance (most over budget first)
  comparisons.sort((a, b) => a.variance - b.variance);

  const totalActual = comparisons.reduce((sum, c) => sum + c.actual, 0);
  const totalBudget = comparisons.reduce((sum, c) => sum + c.budget, 0);
  const totalVariance = totalBudget - totalActual;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-2 font-semibold">{label ? formatMonth(label) : ''}</p>
      <div className="space-y-2">
        {comparisons.map((item) => {
          const isOver = item.actual > item.budget;
          return (
            <div key={item.name} className="text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium">{item.name}</span>
              </div>
              <div className="ml-4 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatCents(item.actual)} spent</span>
                <span>/</span>
                <span>{formatCents(item.budget)} budget</span>
                <span className={`font-medium ${isOver ? 'text-red-600' : 'text-green-600'}`}>
                  ({isOver ? '+' : ''}{formatCents(item.variance * -1)} {isOver ? 'over' : 'under'})
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 border-t pt-2 text-sm">
        <div className="flex justify-between">
          <span>Total Spent</span>
          <span className="font-mono">{formatCents(totalActual)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Total Budget</span>
          <span className="font-mono">{formatCents(totalBudget)}</span>
        </div>
        <div className={`flex justify-between font-semibold ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          <span>{totalVariance >= 0 ? 'Under Budget' : 'Over Budget'}</span>
          <span className="font-mono">{formatCents(Math.abs(totalVariance))}</span>
        </div>
      </div>
    </div>
  );
}

export function BudgetComparisonChart({
  monthlyBudgetComparison,
  budgetCategories,
  colorMap,
}: BudgetComparisonChartProps) {
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  // Transform data for paired lines (actual + budget per category)
  const chartData = useMemo(() => {
    return monthlyBudgetComparison.map((mbc) => {
      const dataPoint: Record<string, number | string> = { month: mbc.month };
      for (const cat of budgetCategories) {
        const catData = mbc.categories[cat.id];
        dataPoint[`${cat.id}_actual`] = catData?.actual ?? 0;
        dataPoint[`${cat.id}_budget`] = catData?.budgeted ?? 0;
      }
      return dataPoint;
    });
  }, [monthlyBudgetComparison, budgetCategories]);

  // Calculate period totals and variance for each category
  const categoryStats = useMemo(() => {
    const stats: Record<string, { actual: number; budget: number; variance: number }> = {};
    for (const cat of budgetCategories) {
      const actual = monthlyBudgetComparison.reduce((sum, m) => {
        return sum + (m.categories[cat.id]?.actual ?? 0);
      }, 0);
      const budget = monthlyBudgetComparison.reduce((sum, m) => {
        return sum + (m.categories[cat.id]?.budgeted ?? 0);
      }, 0);
      stats[cat.id] = { actual, budget, variance: budget - actual };
    }
    return stats;
  }, [monthlyBudgetComparison, budgetCategories]);

  // Sort categories by variance (most over budget first)
  const sortedCategories = useMemo(() => {
    return [...budgetCategories].sort(
      (a, b) => (categoryStats[a.id]?.variance ?? 0) - (categoryStats[b.id]?.variance ?? 0),
    );
  }, [budgetCategories, categoryStats]);

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

  if (budgetCategories.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No budget data available. Set budgets to track spending against targets.
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
            content={<CustomTooltip budgetCategories={budgetCategories} colorMap={colorMap} />}
          />
          <ReferenceLine y={0} stroke="#e5e7eb" />

          {sortedCategories.map((cat) => {
            const isHidden = hiddenCategories.has(cat.id);
            const color = colorMap[cat.id] ?? '#9ca3af';
            return [
              // Budget line (dashed)
              <Line
                key={`${cat.id}_budget`}
                type="monotone"
                dataKey={`${cat.id}_budget`}
                name={`${cat.name} Budget`}
                stroke={color}
                strokeWidth={isHidden ? 0 : 2}
                strokeDasharray="6 4"
                dot={false}
                hide={isHidden}
              />,
              // Actual line (solid)
              <Line
                key={`${cat.id}_actual`}
                type="monotone"
                dataKey={`${cat.id}_actual`}
                name={`${cat.name} Actual`}
                stroke={color}
                strokeWidth={isHidden ? 0 : 2.5}
                dot={{ r: 4, strokeWidth: 0, fill: color }}
                activeDot={{ r: 6 }}
                hide={isHidden}
              />,
            ];
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend Controls */}
      <div className="mt-4 flex justify-center gap-2">
        <button
          onClick={() => setHiddenCategories(new Set())}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Select All
        </button>
        <button
          onClick={() => setHiddenCategories(new Set(sortedCategories.map((c) => c.id)))}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Deselect All
        </button>
      </div>

      {/* Interactive Legend */}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {sortedCategories.map((cat) => {
          const isHidden = hiddenCategories.has(cat.id);
          const stats = categoryStats[cat.id];
          const isOver = stats && stats.actual > stats.budget;
          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all hover:bg-muted ${
                isHidden ? 'opacity-40' : ''
              }`}
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: colorMap[cat.id] }}
              />
              <span className={isHidden ? 'line-through' : ''}>{cat.name}</span>
              <span className={`font-mono text-xs ${isOver ? 'text-red-600' : 'text-green-600'}`}>
                {isOver ? '+' : ''}{formatCents(Math.abs(stats?.variance ?? 0))}
                <span className="ml-0.5 text-muted-foreground">{isOver ? 'over' : 'under'}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 border-t-2 border-dashed border-current" />
          <span>Budget</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 border-t-2 border-current" />
          <span>Actual</span>
        </div>
        <span className="ml-2">Click categories to show/hide</span>
      </div>
    </div>
  );
}
