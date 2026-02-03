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
  showBudget,
  hiddenCategories,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  budgetCategories: Category[];
  colorMap: Record<string, string>;
  showBudget: boolean;
  hiddenCategories: Set<string>;
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
    // Skip hidden categories
    if (hiddenCategories.has(cat.id)) return;

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

  // Sort by actual spending (highest first)
  comparisons.sort((a, b) => b.actual - a.actual);

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
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-medium">{item.name}</span>
              </div>
              <div className="ml-4 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatCents(item.actual)} spent</span>
                {showBudget && item.budget > 0 && (
                  <>
                    <span>/</span>
                    <span>{formatCents(item.budget)} budget</span>
                    <span className={`font-medium ${isOver ? 'text-red-600' : 'text-green-600'}`}>
                      ({isOver ? '+' : ''}
                      {formatCents(item.variance * -1)} {isOver ? 'over' : 'under'})
                    </span>
                  </>
                )}
                {showBudget && item.budget === 0 && <span className="italic">(no budget)</span>}
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
        {showBudget && totalBudget > 0 && (
          <>
            <div className="flex justify-between text-muted-foreground">
              <span>Total Budget</span>
              <span className="font-mono">{formatCents(totalBudget)}</span>
            </div>
            <div
              className={`flex justify-between font-semibold ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              <span>{totalVariance >= 0 ? 'Under Budget' : 'Over Budget'}</span>
              <span className="font-mono">{formatCents(Math.abs(totalVariance))}</span>
            </div>
          </>
        )}
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
  const [showBudget, setShowBudget] = useState(true);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const hasCurrentMonth = monthlyBudgetComparison.some((m) => m.month === currentMonth);
  const hasFutureData = monthlyBudgetComparison.some((m) => m.month > currentMonth);

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

  // Calculate period totals for each category
  const categoryStats = useMemo(() => {
    const stats: Record<
      string,
      { actual: number; budget: number; variance: number; hasBudget: boolean }
    > = {};
    for (const cat of budgetCategories) {
      const actual = monthlyBudgetComparison.reduce((sum, m) => {
        return sum + (m.categories[cat.id]?.actual ?? 0);
      }, 0);
      const budget = monthlyBudgetComparison.reduce((sum, m) => {
        return sum + (m.categories[cat.id]?.budgeted ?? 0);
      }, 0);
      stats[cat.id] = { actual, budget, variance: budget - actual, hasBudget: budget > 0 };
    }
    return stats;
  }, [monthlyBudgetComparison, budgetCategories]);

  // Sort categories by actual spending (highest first)
  const sortedCategories = useMemo(() => {
    return [...budgetCategories].sort(
      (a, b) => (categoryStats[b.id]?.actual ?? 0) - (categoryStats[a.id]?.actual ?? 0),
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

  // Check if all categories are hidden (must check actual IDs, not just count)
  const allHidden =
    sortedCategories.length > 0 && sortedCategories.every((c) => hiddenCategories.has(c.id));

  if (budgetCategories.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No spending data available for this period.
      </div>
    );
  }

  return (
    <div className="w-full">
      {allHidden ? (
        <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
          All categories hidden. Click a category to show it.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData} margin={{ top: 20, right: 55, bottom: 20, left: 20 }}>
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
                  budgetCategories={budgetCategories}
                  colorMap={colorMap}
                  showBudget={showBudget}
                  hiddenCategories={hiddenCategories}
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

            {sortedCategories.flatMap((cat) => {
              const isHidden = hiddenCategories.has(cat.id);
              const color = colorMap[cat.id] ?? '#9ca3af';
              const hasBudget = categoryStats[cat.id]?.hasBudget ?? false;
              const lines = [];

              // Budget line (dashed) - only show if toggle is on AND category has a budget
              if (showBudget && hasBudget) {
                lines.push(
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
                );
              }

              // Actual line (solid)
              lines.push(
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
              );

              return lines;
            })}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Controls row */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          onClick={() => setHiddenCategories(new Set())}
          className="cursor-pointer rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Show All
        </button>
        <button
          onClick={() => setHiddenCategories(new Set(sortedCategories.map((c) => c.id)))}
          className="cursor-pointer rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Hide All
        </button>
        <button
          onClick={() => setShowBudget(!showBudget)}
          className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${
            showBudget
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <div className="h-0.5 w-3 border-t-2 border-dashed border-current" />
          Budget Lines
        </button>
      </div>

      {/* Category legend - centered, sorted by spending */}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {sortedCategories.map((cat) => {
          const isHidden = hiddenCategories.has(cat.id);
          const stats = categoryStats[cat.id];
          const hasBudget = stats?.hasBudget ?? false;
          const isOver = showBudget && hasBudget && stats && stats.actual > stats.budget;
          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-all hover:bg-muted ${
                isHidden ? 'opacity-40' : ''
              }`}
            >
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colorMap[cat.id] }}
              />
              <span className={isHidden ? 'line-through' : ''}>{cat.name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatCents(stats?.actual ?? 0)}
              </span>
              {showBudget && hasBudget && stats && (
                <span className={`text-xs ${isOver ? 'text-red-600' : 'text-green-600'}`}>
                  {isOver ? '▲' : '▼'}
                  {formatCents(Math.abs(stats.variance))}
                </span>
              )}
              {showBudget && !hasBudget && (
                <span className="text-xs text-muted-foreground">(no budget)</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        {hasFutureData
          ? 'Data after the "Now" line is expected. Hover for breakdown.'
          : 'Hover for breakdown.'}
      </p>
    </div>
  );
}
