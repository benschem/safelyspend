import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCents } from '@/lib/utils';
import { CHART_COLORS, buildCategoryColorMap } from '@/lib/chart-colors';

interface CategorySpending {
  categoryId: string | null;
  categoryName: string;
  amount: number;
  hasBudget: boolean;
}

interface SpendingCoverageChartProps {
  categorySpending: CategorySpending[];
}

interface TooltipPayload {
  name: string;
  value: number;
  payload: {
    categoryId: string | null;
    categoryName: string;
    amount: number;
    hasBudget: boolean;
    percent: number;
    fill: string;
  };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <div className="flex items-center gap-2">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: data.fill }}
        />
        <span className="font-medium">{data.categoryName}</span>
      </div>
      <div className="mt-1 text-sm">
        <span className="font-mono">{formatCents(data.amount)}</span>
        <span className="ml-2 text-muted-foreground">
          ({Math.round(data.percent)}%)
        </span>
      </div>
      <div className="mt-1 text-xs">
        {data.hasBudget ? (
          <span className="text-green-600">Has budget</span>
        ) : (
          <span className="text-amber-600">No budget set</span>
        )}
      </div>
    </div>
  );
}

export function SpendingCoverageChart({ categorySpending }: SpendingCoverageChartProps) {
  // Build color map for categories
  const colorMap = useMemo(() => {
    const categoryIds = categorySpending
      .filter((c) => c.categoryId)
      .map((c) => c.categoryId as string);
    return buildCategoryColorMap(categoryIds);
  }, [categorySpending]);

  // Calculate totals
  const { budgetedTotal, unbudgetedTotal, totalSpending, budgetedData, unbudgetedData } = useMemo(() => {
    const budgeted = categorySpending.filter((c) => c.hasBudget && c.amount > 0);
    const unbudgeted = categorySpending.filter((c) => !c.hasBudget && c.amount > 0);

    const budgetedSum = budgeted.reduce((sum, c) => sum + c.amount, 0);
    const unbudgetedSum = unbudgeted.reduce((sum, c) => sum + c.amount, 0);
    const total = budgetedSum + unbudgetedSum;

    // Prepare pie data - budgeted as one segment, unbudgeted broken down by category
    const budgetedData = budgetedSum > 0 ? [{
      categoryId: '__budgeted__',
      categoryName: 'Budgeted Categories',
      amount: budgetedSum,
      hasBudget: true,
      percent: total > 0 ? (budgetedSum / total) * 100 : 0,
      fill: CHART_COLORS.income,
    }] : [];

    const unbudgetedData = unbudgeted.map((c) => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      amount: c.amount,
      hasBudget: false,
      percent: total > 0 ? (c.amount / total) * 100 : 0,
      fill: c.categoryId ? (colorMap[c.categoryId] ?? CHART_COLORS.uncategorized) : CHART_COLORS.uncategorized,
    }));

    return {
      budgetedTotal: budgetedSum,
      unbudgetedTotal: unbudgetedSum,
      totalSpending: total,
      budgetedData,
      unbudgetedData,
    };
  }, [categorySpending, colorMap]);

  const pieData = [...budgetedData, ...unbudgetedData];
  const coveragePercent = totalSpending > 0 ? (budgetedTotal / totalSpending) * 100 : 100;

  if (totalSpending === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No spending data in this period.
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-sm text-muted-foreground">Total Spending</p>
          <p className="text-xl font-bold">{formatCents(totalSpending)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Budgeted</p>
          <p className="text-xl font-bold text-green-600">{formatCents(budgetedTotal)}</p>
          <p className="text-xs text-muted-foreground">{Math.round(coveragePercent)}% covered</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Unbudgeted</p>
          <p className={`text-xl font-bold ${unbudgetedTotal > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {formatCents(unbudgetedTotal)}
          </p>
          <p className="text-xs text-muted-foreground">
            {unbudgetedData.length} {unbudgetedData.length === 1 ? 'category' : 'categories'}
          </p>
        </div>
      </div>

      {/* Donut chart */}
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="amount"
            nameKey="categoryName"
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={2}
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 space-y-2">
        {/* Budgeted section */}
        {budgetedTotal > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-green-50 p-2 dark:bg-green-950/30">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: CHART_COLORS.income }}
              />
              <span className="text-sm font-medium">Budgeted Categories</span>
            </div>
            <span className="font-mono text-sm">{formatCents(budgetedTotal)}</span>
          </div>
        )}

        {/* Unbudgeted categories */}
        {unbudgetedData.length > 0 && (
          <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950/30">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Unbudgeted Categories
              </span>
              <span className="font-mono text-sm text-amber-700 dark:text-amber-400">
                {formatCents(unbudgetedTotal)}
              </span>
            </div>
            <div className="space-y-1">
              {unbudgetedData
                .sort((a, b) => b.amount - a.amount)
                .map((item) => (
                  <div key={item.categoryId ?? 'uncategorized'} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.fill }}
                      />
                      <span>{item.categoryName}</span>
                    </div>
                    <span className="font-mono text-muted-foreground">{formatCents(item.amount)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {coveragePercent >= 100
          ? 'All spending is covered by budgets.'
          : `${Math.round(100 - coveragePercent)}% of spending has no budget set.`}
      </p>
    </div>
  );
}
