import { useMemo } from 'react';
import { Link } from 'react-router';
import { AlertCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { formatCents, formatCentsShort } from '@/lib/utils';
import type { Category } from '@/lib/types';

interface MonthlyBudgetComparison {
  month: string;
  categories: Record<string, { budgeted: number; actual: number }>;
}

interface BudgetHealthTableProps {
  monthlyBudgetComparison: MonthlyBudgetComparison[];
  budgetCategories: Category[];
  colorMap: Record<string, string>;
}

interface CategoryHealth {
  id: string;
  name: string;
  color: string;
  spent: number;
  budget: number;
  percentUsed: number;
  variance: number;
  status: 'good' | 'warning' | 'over';
}

function getStatus(percentUsed: number): 'good' | 'warning' | 'over' {
  if (percentUsed > 100) return 'over';
  if (percentUsed >= 90) return 'warning';
  return 'good';
}

function getStatusColor(status: 'good' | 'warning' | 'over'): string {
  switch (status) {
    case 'over': return '#dc2626'; // red-600
    case 'warning': return '#ca8a04'; // yellow-600
    case 'good': return '#16a34a'; // green-600
  }
}

// Custom tooltip for % used chart
function PercentTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CategoryHealth }> }) {
  if (!active || !payload || !payload[0]) return null;
  const data = payload[0].payload;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-semibold">{data.name}</p>
      <div className="mt-1 space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Spent</span>
          <span className="font-mono">{formatCents(data.spent)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Budget</span>
          <span className="font-mono">{formatCents(data.budget)}</span>
        </div>
        <div className={`flex justify-between gap-4 font-medium ${data.status === 'over' ? 'text-red-600' : data.status === 'warning' ? 'text-yellow-600' : 'text-green-600'}`}>
          <span>% Used</span>
          <span>{data.percentUsed.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

// Custom tooltip for variance chart
function VarianceTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CategoryHealth }> }) {
  if (!active || !payload || !payload[0]) return null;
  const data = payload[0].payload;
  const isOver = data.variance < 0;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-semibold">{data.name}</p>
      <div className="mt-1 space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Spent</span>
          <span className="font-mono">{formatCents(data.spent)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Budget</span>
          <span className="font-mono">{formatCents(data.budget)}</span>
        </div>
        <div className={`flex justify-between gap-4 font-medium ${isOver ? 'text-red-600' : 'text-green-600'}`}>
          <span>{isOver ? 'Over by' : 'Under by'}</span>
          <span>{formatCents(Math.abs(data.variance))}</span>
        </div>
      </div>
    </div>
  );
}

export function BudgetHealthTable({
  monthlyBudgetComparison,
  budgetCategories,
  colorMap,
}: BudgetHealthTableProps) {
  // Separate budgeted and unbudgeted categories
  const { budgetedHealth, unbudgetedStats } = useMemo(() => {
    const budgeted: CategoryHealth[] = [];
    let unbudgetedCount = 0;
    let unbudgetedSpending = 0;

    for (const cat of budgetCategories) {
      let totalSpent = 0;
      let totalBudget = 0;

      for (const mbc of monthlyBudgetComparison) {
        const catData = mbc.categories[cat.id];
        if (catData) {
          totalSpent += catData.actual;
          totalBudget += catData.budgeted;
        }
      }

      if (totalBudget === 0 && totalSpent === 0) continue;

      // If no budget set, track separately
      if (totalBudget === 0) {
        unbudgetedCount++;
        unbudgetedSpending += totalSpent;
        continue;
      }

      const percentUsed = (totalSpent / totalBudget) * 100;
      const variance = totalBudget - totalSpent;
      const status = getStatus(percentUsed);

      budgeted.push({
        id: cat.id,
        name: cat.name,
        color: colorMap[cat.id] ?? '#9ca3af',
        spent: totalSpent,
        budget: totalBudget,
        percentUsed: Math.min(percentUsed, 200), // Cap at 200% for display
        variance,
        status,
      });
    }

    return {
      budgetedHealth: budgeted,
      unbudgetedStats: { count: unbudgetedCount, spending: unbudgetedSpending },
    };
  }, [monthlyBudgetComparison, budgetCategories, colorMap]);

  const categoryHealth = budgetedHealth;

  // Sort by % used for the percent chart
  const sortedByPercent = useMemo(() => {
    return [...categoryHealth].sort((a, b) => b.percentUsed - a.percentUsed);
  }, [categoryHealth]);

  // Sort by variance for the variance chart (most over first)
  const sortedByVariance = useMemo(() => {
    return [...categoryHealth].sort((a, b) => a.variance - b.variance);
  }, [categoryHealth]);

  // Calculate summary stats
  const summary = useMemo(() => {
    const totalSpent = categoryHealth.reduce((sum, c) => sum + c.spent, 0);
    const totalBudget = categoryHealth.reduce((sum, c) => sum + c.budget, 0);
    const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const variance = totalBudget - totalSpent;
    const overCount = categoryHealth.filter((c) => c.status === 'over').length;
    const warningCount = categoryHealth.filter((c) => c.status === 'warning').length;
    const goodCount = categoryHealth.filter((c) => c.status === 'good').length;

    return { totalSpent, totalBudget, percentUsed, variance, overCount, warningCount, goodCount };
  }, [categoryHealth]);

  if (categoryHealth.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No budget data available. Set budgets to track spending against targets.
      </div>
    );
  }

  const chartHeight = Math.max(250, categoryHealth.length * 40);

  return (
    <div className="space-y-8">
      {/* Overall Health Summary */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Overall Budget Health</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${summary.percentUsed > 100 ? 'text-red-600' : summary.percentUsed >= 90 ? 'text-yellow-600' : 'text-green-600'}`}>
                {summary.percentUsed.toFixed(0)}%
              </span>
              <span className="text-sm text-muted-foreground">of budget used</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              {formatCents(summary.totalSpent)} of {formatCents(summary.totalBudget)}
            </div>
            <div className={`text-sm font-medium ${summary.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.variance >= 0 ? `${formatCents(summary.variance)} under` : `${formatCents(Math.abs(summary.variance))} over`}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all ${summary.percentUsed > 100 ? 'bg-red-500' : summary.percentUsed >= 90 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(summary.percentUsed, 100)}%` }}
          />
        </div>

        {/* Category status counts */}
        <div className="mt-3 flex gap-4 text-xs">
          {summary.overCount > 0 && (
            <span className="text-red-600">{summary.overCount} over budget</span>
          )}
          {summary.warningCount > 0 && (
            <span className="text-yellow-600">{summary.warningCount} near limit</span>
          )}
          {summary.goodCount > 0 && (
            <span className="text-green-600">{summary.goodCount} on track</span>
          )}
        </div>
      </div>

      {/* Unbudgeted categories warning */}
      {unbudgetedStats.count > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-500/30 bg-orange-50 p-4 dark:bg-orange-950/20">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
              {unbudgetedStats.count} {unbudgetedStats.count === 1 ? 'category has' : 'categories have'} no budget set
            </p>
            <p className="mt-0.5 text-sm text-orange-700 dark:text-orange-300">
              {formatCents(unbudgetedStats.spending)} in spending is not being tracked against a budget.
            </p>
          </div>
          <Link
            to="/budget"
            className="shrink-0 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
          >
            Set Budgets
          </Link>
        </div>
      )}

      {/* % of Budget Used Chart */}
      <div>
        <h3 className="mb-1 text-sm font-semibold">% of Budget Used</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Which categories are proportionally most over budget?
        </p>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={sortedByPercent}
            layout="vertical"
            margin={{ top: 0, right: 40, bottom: 0, left: 100 }}
          >
            <XAxis
              type="number"
              domain={[0, (dataMax: number) => Math.max(dataMax, 110)]}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={95}
            />
            <Tooltip content={<PercentTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
            <ReferenceLine x={100} stroke="#6b7280" strokeDasharray="4 4" label={{ value: '100%', position: 'top', fontSize: 10, fill: '#6b7280' }} />
            <Bar dataKey="percentUsed" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {sortedByPercent.map((entry) => (
                <Cell key={entry.id} fill={getStatusColor(entry.status)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Variance Chart */}
      <div>
        <h3 className="mb-1 text-sm font-semibold">Budget Variance</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Which categories cost you the most in absolute dollars?
        </p>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={sortedByVariance}
            layout="vertical"
            margin={{ top: 0, right: 40, bottom: 0, left: 100 }}
          >
            <XAxis
              type="number"
              tickFormatter={(value) => formatCentsShort(Math.abs(value))}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={95}
            />
            <Tooltip content={<VarianceTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
            <ReferenceLine x={0} stroke="#6b7280" />
            <Bar dataKey="variance" radius={4} maxBarSize={28}>
              {sortedByVariance.map((entry) => (
                <Cell key={entry.id} fill={entry.variance >= 0 ? '#16a34a' : '#dc2626'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-600" />
            Over budget
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-600" />
            Under budget
          </span>
        </div>
      </div>
    </div>
  );
}
