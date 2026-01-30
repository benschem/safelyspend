import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Switch } from '@/components/ui/switch';
import { Pencil, Trash2, Plus, ClipboardList } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useScenarios } from '@/hooks/use-scenarios';
import { ScenarioSelector } from '@/components/scenario-selector';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useCategories } from '@/hooks/use-categories';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { CategoryBudgetDialog } from '@/components/dialogs/category-budget-dialog';
import { BudgetRuleDialog } from '@/components/dialogs/budget-rule-dialog';
import { formatCents, formatISODate } from '@/lib/utils';
import type { Cadence, BudgetRule } from '@/lib/types';
import { SpendingBreakdownChart } from '@/components/charts/spending-breakdown-chart';
import { buildCategoryColorMap } from '@/lib/chart-colors';

interface OutletContext {
  activeScenarioId: string | null;
}

interface BudgetRow {
  id: string;
  categoryId: string;
  categoryName: string;
  spent: number;
  forecasted: number;
  projectedTotal: number;
  budgetAmount: number;
  cadence: Cadence | null;
  projectedRemaining: number;
  spentPercent: number;
  projectedPercent: number;
  periodProgress: number;
  expectedSpend: number;
  burnRate: number;
  daysElapsed: number;
  totalDays: number;
  status: 'over' | 'overspending' | 'watch' | 'good' | 'untracked';
  rule: BudgetRule | null;
}

const CADENCE_LABELS: Record<Cadence, string> = {
  weekly: '/wk',
  fortnightly: '/fn',
  monthly: '/mo',
  quarterly: '/qtr',
  yearly: '/yr',
};

function getPeriodProgress(cadence: Cadence): { daysElapsed: number; totalDays: number; progress: number } {
  const range = getCurrentPeriodRange(cadence);
  const start = new Date(range.start);
  const end = new Date(range.end);
  const now = new Date();

  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysElapsed = Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const progress = Math.min((daysElapsed / totalDays) * 100, 100);

  return { daysElapsed, totalDays, progress };
}

function getCurrentPeriodRange(cadence: Cadence): { start: string; end: string } {
  const now = new Date();

  switch (cadence) {
    case 'weekly': {
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(monday.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      return { start: formatISODate(monday), end: formatISODate(sunday) };
    }
    case 'fortnightly': {
      const epoch = new Date('2024-01-01');
      const diffDays = Math.floor((now.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
      const fortnightNumber = Math.floor(diffDays / 14);
      const fortnightStart = new Date(epoch);
      fortnightStart.setDate(fortnightStart.getDate() + fortnightNumber * 14);
      const fortnightEnd = new Date(fortnightStart);
      fortnightEnd.setDate(fortnightEnd.getDate() + 13);
      return { start: formatISODate(fortnightStart), end: formatISODate(fortnightEnd) };
    }
    case 'monthly': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: formatISODate(start), end: formatISODate(end) };
    }
    case 'quarterly': {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), quarterStart, 1);
      const end = new Date(now.getFullYear(), quarterStart + 3, 0);
      return { start: formatISODate(start), end: formatISODate(end) };
    }
    case 'yearly': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { start: formatISODate(start), end: formatISODate(end) };
    }
  }
}

function getRemainingPeriodRange(cadence: Cadence): { start: string; end: string } {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const periodEnd = getCurrentPeriodRange(cadence).end;
  return { start: formatISODate(tomorrow), end: periodEnd };
}

function getStatus(spentPercent: number, burnRate: number): 'over' | 'overspending' | 'watch' | 'good' {
  if (spentPercent >= 100) return 'over';
  if (burnRate > 120) return 'overspending';
  if (burnRate > 100) return 'watch';
  return 'good';
}

function getSpentBarColor(status: 'over' | 'overspending' | 'watch' | 'good' | 'untracked'): string {
  switch (status) {
    case 'over':
      return 'bg-red-500';
    case 'overspending':
      return 'bg-amber-500';
    case 'watch':
      return 'bg-yellow-500';
    case 'good':
    case 'untracked':
      return 'bg-green-500';
  }
}

function getStatusTextColor(status: 'over' | 'overspending' | 'watch' | 'good' | 'untracked'): string {
  switch (status) {
    case 'over':
      return 'text-red-600';
    case 'overspending':
      return 'text-amber-600';
    case 'watch':
      return 'text-yellow-600';
    case 'good':
      return 'text-green-600';
    case 'untracked':
      return 'text-muted-foreground';
  }
}

export function BudgetPlanPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { activeCategories, isLoading: categoriesLoading, addCategory } = useCategories();
  const { allTransactions } = useTransactions();
  const { getRuleForCategory, isLoading: budgetLoading, setBudgetForCategory, deleteBudgetRule } =
    useBudgetRules(activeScenarioId);

  const isLoading = categoriesLoading || budgetLoading;

  const remainingPeriodRanges = useMemo(() => {
    const ranges: Record<Cadence, { start: string; end: string }> = {
      weekly: getRemainingPeriodRange('weekly'),
      fortnightly: getRemainingPeriodRange('fortnightly'),
      monthly: getRemainingPeriodRange('monthly'),
      quarterly: getRemainingPeriodRange('quarterly'),
      yearly: getRemainingPeriodRange('yearly'),
    };
    return ranges;
  }, []);

  const maxEndDate = useMemo(() => {
    return Object.values(remainingPeriodRanges).reduce(
      (max, range) => (range.end > max ? range.end : max),
      '',
    );
  }, [remainingPeriodRanges]);

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatISODate(d);
  }, []);

  const { expenseForecasts, savingsForecasts } = useForecasts(activeScenarioId, tomorrow, maxEndDate);

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<BudgetRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showSavingsInChart, setShowSavingsInChart] = useState(true);

  const categorySpending = useMemo(() => {
    const spending: Record<string, Record<Cadence, number>> = {};
    const periodRanges: Record<Cadence, { start: string; end: string }> = {
      weekly: getCurrentPeriodRange('weekly'),
      fortnightly: getCurrentPeriodRange('fortnightly'),
      monthly: getCurrentPeriodRange('monthly'),
      quarterly: getCurrentPeriodRange('quarterly'),
      yearly: getCurrentPeriodRange('yearly'),
    };

    const expenses = allTransactions.filter((t) => t.type === 'expense');

    for (const cat of activeCategories) {
      spending[cat.id] = {
        weekly: 0,
        fortnightly: 0,
        monthly: 0,
        quarterly: 0,
        yearly: 0,
      };

      for (const cadence of Object.keys(periodRanges) as Cadence[]) {
        const { start, end } = periodRanges[cadence];
        spending[cat.id]![cadence] = expenses
          .filter((t) => t.categoryId === cat.id && t.date >= start && t.date <= end)
          .reduce((sum, t) => sum + t.amountCents, 0);
      }
    }

    return spending;
  }, [allTransactions, activeCategories]);

  const categoryForecasts = useMemo(() => {
    const forecasts: Record<string, Record<Cadence, number>> = {};

    for (const cat of activeCategories) {
      forecasts[cat.id] = {
        weekly: 0,
        fortnightly: 0,
        monthly: 0,
        quarterly: 0,
        yearly: 0,
      };
    }

    for (const forecast of expenseForecasts) {
      if (!forecast.categoryId) continue;

      for (const cadence of Object.keys(remainingPeriodRanges) as Cadence[]) {
        const { start, end } = remainingPeriodRanges[cadence];
        if (forecast.date >= start && forecast.date <= end) {
          if (forecasts[forecast.categoryId]) {
            forecasts[forecast.categoryId]![cadence] += forecast.amountCents;
          }
        }
      }
    }

    return forecasts;
  }, [expenseForecasts, activeCategories, remainingPeriodRanges]);

  const allRows: BudgetRow[] = useMemo(() => {
    return activeCategories.map((category) => {
      const rule = getRuleForCategory(category.id);
      const cadence = rule?.cadence ?? null;
      const budgetAmount = rule?.amountCents ?? 0;

      const spent = cadence
        ? categorySpending[category.id]?.[cadence] ?? 0
        : categorySpending[category.id]?.monthly ?? 0;

      const forecasted = cadence
        ? categoryForecasts[category.id]?.[cadence] ?? 0
        : categoryForecasts[category.id]?.monthly ?? 0;

      const projectedTotal = spent + forecasted;
      const projectedRemaining = budgetAmount - projectedTotal;
      const spentPercent = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
      const projectedPercent = budgetAmount > 0 ? (projectedTotal / budgetAmount) * 100 : 0;

      const periodInfo = cadence ? getPeriodProgress(cadence) : { daysElapsed: 1, totalDays: 1, progress: 100 };
      const expectedSpend = budgetAmount * (periodInfo.progress / 100);
      const burnRate = expectedSpend > 0 ? (spent / expectedSpend) * 100 : (spent > 0 ? 200 : 0);

      const status: BudgetRow['status'] = !rule
        ? 'untracked'
        : getStatus(spentPercent, burnRate);

      return {
        id: category.id,
        categoryId: category.id,
        categoryName: category.name,
        spent,
        forecasted,
        projectedTotal,
        budgetAmount,
        cadence,
        projectedRemaining,
        spentPercent,
        projectedPercent,
        periodProgress: periodInfo.progress,
        expectedSpend,
        burnRate,
        daysElapsed: periodInfo.daysElapsed,
        totalDays: periodInfo.totalDays,
        status,
        rule,
      };
    });
  }, [activeCategories, getRuleForCategory, categorySpending, categoryForecasts]);

  const sortedRows = useMemo(() => {
    const statusOrder = { over: 0, overspending: 1, watch: 2, good: 3, untracked: 4 };
    return [...allRows].sort((a, b) => {
      const orderDiff = statusOrder[a.status] - statusOrder[b.status];
      if (orderDiff !== 0) return orderDiff;
      return b.burnRate - a.burnRate;
    });
  }, [allRows]);

  const categoryColorMap = useMemo(() => {
    const map = buildCategoryColorMap(activeCategories.map((c) => c.id));
    map['savings'] = '#3b82f6';
    return map;
  }, [activeCategories]);

  // Normalize amounts to monthly equivalents for accurate comparison
  const toMonthly = (amount: number, cadence: Cadence): number => {
    switch (cadence) {
      case 'weekly': return Math.round(amount * 52 / 12);
      case 'fortnightly': return Math.round(amount * 26 / 12);
      case 'monthly': return amount;
      case 'quarterly': return Math.round(amount / 3);
      case 'yearly': return Math.round(amount / 12);
    }
  };

  const budgetBreakdownSegments = useMemo(() => {
    const tracked = allRows.filter((r) => r.rule && r.budgetAmount > 0);
    const categorySegments = tracked
      .map((row) => ({
        id: row.categoryId,
        name: row.categoryName,
        amount: toMonthly(row.budgetAmount, row.cadence!),
      }))
      .sort((a, b) => b.amount - a.amount);

    if (showSavingsInChart) {
      // Savings forecasts are already date-based, sum those in the current month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const monthlySavings = savingsForecasts
        .filter((f) => f.date >= monthStart && f.date <= monthEnd)
        .reduce((sum, f) => sum + f.amountCents, 0);
      if (monthlySavings > 0) {
        categorySegments.push({
          id: 'savings',
          name: 'Savings',
          amount: monthlySavings,
        });
      }
    }

    return categorySegments;
  }, [allRows, savingsForecasts, showSavingsInChart]);

  const budgetBreakdownTotal = useMemo(() => {
    return budgetBreakdownSegments.reduce((sum, s) => sum + s.amount, 0);
  }, [budgetBreakdownSegments]);

  const openEditDialog = useCallback((row: BudgetRow) => {
    setEditingRow(row);
    setEditDialogOpen(true);
  }, []);

  const handleEditDialogClose = useCallback((open: boolean) => {
    setEditDialogOpen(open);
    if (!open) {
      setEditingRow(null);
    }
  }, []);

  const handleDelete = useCallback(
    (categoryId: string) => {
      if (deletingId === categoryId) {
        const rule = getRuleForCategory(categoryId);
        if (rule) {
          deleteBudgetRule(rule.id);
        }
        setDeletingId(null);
      } else {
        setDeletingId(categoryId);
      }
    },
    [deletingId, getRuleForCategory, deleteBudgetRule],
  );

  // Close delete confirmation on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && deletingId) {
        setDeletingId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deletingId]);

  const columns: ColumnDef<BudgetRow>[] = useMemo(
    () => [
      {
        accessorKey: 'categoryName',
        header: ({ column }) => <SortableHeader column={column}>Category</SortableHeader>,
        cell: ({ row }) => {
          const budgetRow = row.original;
          return (
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  budgetRow.status === 'over'
                    ? 'bg-red-500'
                    : budgetRow.status === 'overspending'
                      ? 'bg-amber-500'
                      : budgetRow.status === 'watch'
                        ? 'bg-yellow-500'
                        : budgetRow.status === 'good'
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                }`}
              />
              <button
                type="button"
                onClick={() => openEditDialog(budgetRow)}
                className="cursor-pointer text-left font-medium hover:underline"
              >
                {budgetRow.categoryName}
              </button>
            </div>
          );
        },
      },
      {
        accessorKey: 'spent',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Spent
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const budgetRow = row.original;
          const dayLabel = budgetRow.cadence
            ? `Day ${budgetRow.daysElapsed}/${budgetRow.totalDays}`
            : '';
          return (
            <div className="text-right">
              <div className="font-mono">{formatCents(row.getValue('spent'))}</div>
              {budgetRow.forecasted > 0 ? (
                <div className="text-xs text-muted-foreground">
                  +{formatCents(budgetRow.forecasted)} forecast
                </div>
              ) : dayLabel ? (
                <div className="text-xs text-muted-foreground">{dayLabel}</div>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: 'budgetAmount',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Limit
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const budgetRow = row.original;

          if (!budgetRow.rule) {
            return (
              <button
                type="button"
                onClick={() => openEditDialog(budgetRow)}
                className="text-right text-sm text-muted-foreground hover:text-foreground"
              >
                Set limit
              </button>
            );
          }

          return (
            <div className="text-right font-mono">
              {formatCents(budgetRow.budgetAmount)}
              <span className="text-muted-foreground">{CADENCE_LABELS[budgetRow.cadence!]}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'projectedRemaining',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Remaining
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const budgetRow = row.original;
          if (!budgetRow.rule) {
            return <div className="text-right text-muted-foreground">—</div>;
          }
          const isProjected = budgetRow.forecasted > 0;
          return (
            <div className="text-right">
              <div className={`font-mono ${getStatusTextColor(budgetRow.status)}`}>
                {budgetRow.projectedRemaining >= 0 ? '+' : ''}
                {formatCents(budgetRow.projectedRemaining)}
              </div>
              {isProjected && (
                <div className="text-xs text-muted-foreground">projected</div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'spentPercent',
        header: ({ column }) => <SortableHeader column={column}>Progress</SortableHeader>,
        cell: ({ row }) => {
          const budgetRow = row.original;
          if (!budgetRow.rule) {
            return <div className="text-muted-foreground">—</div>;
          }

          const spentPercent = Math.min(budgetRow.spentPercent, 100);
          const forecastPercent = Math.min(budgetRow.projectedPercent, 100) - spentPercent;
          const displayPercent = Math.round(budgetRow.spentPercent);
          const expectedPercent = budgetRow.periodProgress;
          const baseColor = getSpentBarColor(budgetRow.status);

          return (
            <div className="flex items-center gap-2">
              <div className="relative w-full min-w-[80px]">
                <div
                  className="absolute -top-1 h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-gray-500 dark:border-t-gray-400"
                  style={{ left: `calc(${Math.min(expectedPercent, 100)}% - 4px)` }}
                  title={`Day ${budgetRow.daysElapsed} of ${budgetRow.totalDays}`}
                />
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`absolute left-0 h-2 transition-all ${baseColor} ${
                      forecastPercent <= 0 ? 'rounded-full' : 'rounded-l-full'
                    }`}
                    style={{ width: `${spentPercent}%` }}
                  />
                  {forecastPercent > 0 && (
                    <div
                      className={`absolute h-2 rounded-r-full transition-all ${baseColor} opacity-40`}
                      style={{
                        left: `${spentPercent}%`,
                        width: `${forecastPercent}%`,
                      }}
                    />
                  )}
                </div>
              </div>
              <span className={`w-12 text-right text-sm ${getStatusTextColor(budgetRow.status)}`}>
                {displayPercent}%
              </span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const budgetRow = row.original;
          const isDeleting = deletingId === budgetRow.id;

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(budgetRow)}
                aria-label="Edit spending limit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {budgetRow.rule && (
                <Button
                  variant={isDeleting ? 'destructive' : 'ghost'}
                  size="sm"
                  onClick={() => handleDelete(budgetRow.id)}
                  onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                  aria-label={isDeleting ? 'Confirm delete' : 'Delete spending limit'}
                >
                  {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [deletingId, openEditDialog, handleDelete],
  );

  // Show loading spinner while data is being fetched
  if (isLoading) {
    return (
      <div className="page-shell">
        <PageLoading />
      </div>
    );
  }

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <ClipboardList className="h-5 w-5 text-slate-500" />
            </div>
            Budget Plan
          </h1>
          <p className="page-description">Set spending limits by category</p>
        </div>
        <div className="empty-state">
          <p className="empty-state-text">Select a scenario to configure spending limits.</p>
          <Button asChild className="empty-state-action">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <ClipboardList className="h-5 w-5 text-slate-500" />
            </div>
            Budget Plan
          </h1>
          <p className="page-description">Set spending limits by category</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ScenarioSelector />
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Breakdown Chart */}
      {budgetBreakdownSegments.length > 0 && (
        <div className="rounded-lg border p-4">
          <div>
            <h2 className="text-lg font-semibold">Breakdown</h2>
            <p className="text-sm text-muted-foreground">How your budget is split across categories</p>
          </div>
          <div className="mt-4">
            <SpendingBreakdownChart
              segments={budgetBreakdownSegments}
              total={budgetBreakdownTotal}
              colorMap={categoryColorMap}
            />
          </div>
          <div className="mt-4 flex items-center justify-end">
            <label htmlFor="compare-savings" className="flex items-center gap-2 text-sm">
              <Switch
                id="compare-savings"
                checked={showSavingsInChart}
                onCheckedChange={setShowSavingsInChart}
              />
              <span className="text-muted-foreground">Compare Savings</span>
            </label>
          </div>
        </div>
      )}

      {activeCategories.length === 0 ? (
        <div className="mt-8 space-y-4">
          <Alert variant="info">
            Spending limits help you control how much you spend in each category. Create categories first.
          </Alert>
          <div className="empty-state">
            <p className="empty-state-text">No categories found.</p>
            <Button className="empty-state-action" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <DataTable
            columns={columns}
            data={sortedRows}
            searchKey="categoryName"
            searchPlaceholder="Search categories..."
            showPagination={false}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Spent amounts are calculated for each limit&apos;s cadence period (e.g., weekly limits show this week&apos;s spending).
          </p>
        </div>
      )}

      <CategoryBudgetDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        scenarioId={activeScenarioId}
        addCategory={addCategory}
        setBudgetForCategory={setBudgetForCategory}
      />

      {editingRow && (
        <BudgetRuleDialog
          open={editDialogOpen}
          onOpenChange={handleEditDialogClose}
          categoryId={editingRow.categoryId}
          categoryName={editingRow.categoryName}
          rule={editingRow.rule}
          setBudgetForCategory={setBudgetForCategory}
          deleteBudgetRule={deleteBudgetRule}
        />
      )}
    </div>
  );
}
