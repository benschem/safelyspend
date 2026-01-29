import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Pencil, Check, X, Trash2, Plus, Target, AlertTriangle, CheckCircle2, XCircle, PiggyBank } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { ScenarioSelector } from '@/components/scenario-selector';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useCategories } from '@/hooks/use-categories';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { CategoryBudgetDialog } from '@/components/dialogs/category-budget-dialog';
import { formatCents, parseCentsFromInput, formatISODate } from '@/lib/utils';
import type { Cadence, BudgetRule } from '@/lib/types';

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
  periodProgress: number; // 0-100, how far through the period we are
  expectedSpend: number; // What we should have spent by now
  burnRate: number; // spent / expectedSpend * 100 (100 = on pace)
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

const CADENCE_FULL_LABELS: Record<Cadence, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

/**
 * Get period progress info for a given cadence
 */
function getPeriodProgress(cadence: Cadence): { daysElapsed: number; totalDays: number; progress: number } {
  const range = getCurrentPeriodRange(cadence);
  const start = new Date(range.start);
  const end = new Date(range.end);
  const now = new Date();

  // Set to start of day for accurate day counting
  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysElapsed = Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const progress = Math.min((daysElapsed / totalDays) * 100, 100);

  return { daysElapsed, totalDays, progress };
}

/**
 * Get the current period date range for a given cadence
 */
function getCurrentPeriodRange(cadence: Cadence): { start: string; end: string } {
  const now = new Date();

  switch (cadence) {
    case 'weekly': {
      // Monday to Sunday containing today
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(monday.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      return { start: formatISODate(monday), end: formatISODate(sunday) };
    }
    case 'fortnightly': {
      // Use a fixed epoch (Jan 1, 2024 was a Monday) to determine fortnight boundaries
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

/**
 * Get remaining period range (from tomorrow to end of period)
 */
function getRemainingPeriodRange(cadence: Cadence): { start: string; end: string } {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const periodEnd = getCurrentPeriodRange(cadence).end;
  return { start: formatISODate(tomorrow), end: periodEnd };
}

/**
 * Get status based on burn rate (spending pace vs period progress)
 * - over: Already spent more than budget
 * - overspending: Spending 20%+ faster than period allows
 * - watch: Spending slightly faster than period allows
 * - good: On pace or under
 */
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

export function BudgetPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { activeCategories } = useCategories();
  const { allTransactions, savingsTransactions } = useTransactions();
  const { getRuleForCategory, setBudgetForCategory, deleteBudgetRule } =
    useBudgetRules(activeScenarioId);

  // Get forecasts for each cadence's remaining period
  // We need to compute forecasts from tomorrow to end of period for each cadence type
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

  // Get forecasts for all periods - use the max range to cover all cadences
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCadence, setEditCadence] = useState<Cadence>('monthly');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Calculate spending per category for their respective current periods
  const categorySpending = useMemo(() => {
    const spending: Record<string, Record<Cadence, number>> = {};

    // Pre-calculate all period ranges
    const periodRanges: Record<Cadence, { start: string; end: string }> = {
      weekly: getCurrentPeriodRange('weekly'),
      fortnightly: getCurrentPeriodRange('fortnightly'),
      monthly: getCurrentPeriodRange('monthly'),
      quarterly: getCurrentPeriodRange('quarterly'),
      yearly: getCurrentPeriodRange('yearly'),
    };

    // Filter expense transactions
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

  // Calculate forecasted expenses per category per cadence (for remaining period)
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

    // Sum expense forecasts by category and determine which cadence periods they fall into
    for (const forecast of expenseForecasts) {
      if (!forecast.categoryId) continue;

      // For each cadence, check if this forecast date falls within that remaining period
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

  // Build rows for all active categories
  const allRows: BudgetRow[] = useMemo(() => {
    return activeCategories.map((category) => {
      const rule = getRuleForCategory(category.id);
      const cadence = rule?.cadence ?? null;
      const budgetAmount = rule?.amountCents ?? 0;

      // Get spent amount for the rule's cadence (or monthly as default for display)
      const spent = cadence
        ? categorySpending[category.id]?.[cadence] ?? 0
        : categorySpending[category.id]?.monthly ?? 0;

      // Get forecasted amount for remaining period
      const forecasted = cadence
        ? categoryForecasts[category.id]?.[cadence] ?? 0
        : categoryForecasts[category.id]?.monthly ?? 0;

      const projectedTotal = spent + forecasted;
      const projectedRemaining = budgetAmount - projectedTotal;
      const spentPercent = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
      const projectedPercent = budgetAmount > 0 ? (projectedTotal / budgetAmount) * 100 : 0;

      // Calculate period progress and burn rate
      const periodInfo = cadence ? getPeriodProgress(cadence) : { daysElapsed: 1, totalDays: 1, progress: 100 };
      const expectedSpend = budgetAmount * (periodInfo.progress / 100);
      // Burn rate: how fast we're spending vs expected pace (100 = exactly on pace)
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

  // Sort: over first, then overspending, then watch, then good, then untracked
  const sortedRows = useMemo(() => {
    const statusOrder = { over: 0, overspending: 1, watch: 2, good: 3, untracked: 4 };
    return [...allRows].sort((a, b) => {
      const orderDiff = statusOrder[a.status] - statusOrder[b.status];
      if (orderDiff !== 0) return orderDiff;
      // Within same status, sort by burn rate descending
      return b.burnRate - a.burnRate;
    });
  }, [allRows]);

  // Calculate summary stats
  const summary = useMemo(() => {
    const tracked = allRows.filter((r) => r.rule);
    const untracked = allRows.filter((r) => !r.rule);
    const totalSpent = tracked.reduce((sum, r) => sum + r.spent, 0);
    const totalForecasted = tracked.reduce((sum, r) => sum + r.forecasted, 0);
    const totalProjected = totalSpent + totalForecasted;
    const totalBudget = tracked.reduce((sum, r) => sum + r.budgetAmount, 0);
    const totalProjectedRemaining = totalBudget - totalProjected;
    const overCount = tracked.filter((r) => r.status === 'over').length;
    const overspendingCount = tracked.filter((r) => r.status === 'overspending').length;
    const watchCount = tracked.filter((r) => r.status === 'watch').length;
    const goodCount = tracked.filter((r) => r.status === 'good').length;
    const untrackedCount = untracked.length;
    // Sum spending on untracked categories (use monthly as reference period)
    const untrackedSpent = untracked.reduce((sum, r) => sum + r.spent, 0);
    // Sum forecasted savings
    const totalSavingsForecasted = savingsForecasts.reduce((sum, f) => sum + f.amountCents, 0);
    // Sum existing savings from transactions
    const totalSavingsActual = savingsTransactions.reduce((sum, t) => sum + t.amountCents, 0);
    const totalSavingsProjected = totalSavingsActual + totalSavingsForecasted;

    return {
      totalSpent,
      totalForecasted,
      totalProjected,
      totalBudget,
      totalProjectedRemaining,
      totalSavingsForecasted,
      totalSavingsProjected,
      overCount,
      overspendingCount,
      watchCount,
      goodCount,
      untrackedCount,
      untrackedSpent,
      trackedCount: tracked.length,
    };
  }, [allRows, savingsForecasts, savingsTransactions]);

  const startEditing = useCallback((categoryId: string) => {
    // Read fresh from rule to avoid stale row data
    const rule = getRuleForCategory(categoryId);
    setEditAmount(rule?.amountCents ? (rule.amountCents / 100).toFixed(2) : '');
    setEditCadence(rule?.cadence ?? 'monthly');
    setEditingId(categoryId);
  }, [getRuleForCategory]);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditAmount('');
    setEditCadence('monthly');
  }, []);

  const saveEditing = useCallback(
    (categoryId: string) => {
      const amountCents = parseCentsFromInput(editAmount);
      if (amountCents > 0) {
        setBudgetForCategory(categoryId, amountCents, editCadence);
      } else {
        // If amount is 0 or empty, delete the rule
        const rule = getRuleForCategory(categoryId);
        if (rule) {
          deleteBudgetRule(rule.id);
        }
      }
      cancelEditing();
    },
    [editAmount, editCadence, setBudgetForCategory, getRuleForCategory, deleteBudgetRule, cancelEditing],
  );

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

  // Close editors on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) cancelEditing();
        if (deletingId) setDeletingId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingId, deletingId, cancelEditing]);

  const columns: ColumnDef<BudgetRow>[] = useMemo(
    () => [
      {
        accessorKey: 'categoryName',
        header: ({ column }) => <SortableHeader column={column}>Category</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                row.original.status === 'over'
                  ? 'bg-red-500'
                  : row.original.status === 'overspending'
                    ? 'bg-amber-500'
                    : row.original.status === 'watch'
                      ? 'bg-yellow-500'
                      : row.original.status === 'good'
                        ? 'bg-green-500'
                        : 'bg-gray-300'
              }`}
            />
            <span className="font-medium">{row.getValue('categoryName')}</span>
          </div>
        ),
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
            Budget
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const budgetRow = row.original;
          const isEditing = editingId === budgetRow.id;

          if (isEditing) {
            return (
              <div className="flex items-center justify-end gap-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="h-8 w-24 text-right"
                  placeholder="0.00"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEditing(budgetRow.id);
                    if (e.key === 'Escape') cancelEditing();
                  }}
                  autoFocus
                />
                <Select value={editCadence} onValueChange={(v) => setEditCadence(v as Cadence)}>
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CADENCE_FULL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          if (!budgetRow.rule) {
            return (
              <button
                onClick={() => startEditing(budgetRow.categoryId)}
                className="text-right text-sm text-muted-foreground hover:text-foreground"
              >
                Set budget
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
                {/* Expected spend marker - triangle above the bar */}
                <div
                  className="absolute -top-1 h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-gray-500 dark:border-t-gray-400"
                  style={{ left: `calc(${Math.min(expectedPercent, 100)}% - 4px)` }}
                  title={`Day ${budgetRow.daysElapsed} of ${budgetRow.totalDays}`}
                />
                {/* Progress bar */}
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  {/* Spent portion (solid) */}
                  <div
                    className={`absolute left-0 h-2 transition-all ${baseColor} ${
                      forecastPercent <= 0 ? 'rounded-full' : 'rounded-l-full'
                    }`}
                    style={{ width: `${spentPercent}%` }}
                  />
                  {/* Forecast portion (same color, transparent) */}
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
          const isEditing = editingId === budgetRow.id;
          const isDeleting = deletingId === budgetRow.id;

          if (isEditing) {
            return (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => saveEditing(budgetRow.id)}
                  title="Save"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={cancelEditing} title="Cancel">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          }

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditing(budgetRow.categoryId)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {budgetRow.rule && (
                <Button
                  variant={isDeleting ? 'destructive' : 'ghost'}
                  size="sm"
                  onClick={() => handleDelete(budgetRow.id)}
                  onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                  title={isDeleting ? 'Click again to confirm' : 'Delete'}
                >
                  {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [
      editingId,
      editAmount,
      editCadence,
      deletingId,
      startEditing,
      cancelEditing,
      saveEditing,
      handleDelete,
    ],
  );

  if (!activeScenarioId || !activeScenario) {
    return (
      <div>
        <div className="mb-20">
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Target className="h-7 w-7" />
            Budget
          </h1>
          <p className="mt-1 text-muted-foreground">Track spending against your targets</p>
        </div>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Select a scenario to view budgets.</p>
          <Button asChild className="mt-4">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-20 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Target className="h-7 w-7" />
            Budget
          </h1>
          <p className="mt-1 text-muted-foreground">Track spending against your targets</p>
        </div>
        <div className="flex items-center gap-4">
          <ScenarioSelector />
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {summary.trackedCount > 0 && (
        <div className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {summary.totalProjectedRemaining >= 0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              Projected Spending
            </div>
            <p className={`mt-1 text-xl font-bold ${summary.totalProjectedRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCents(Math.abs(summary.totalProjectedRemaining))} {summary.totalProjectedRemaining >= 0 ? 'under' : 'over'}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.totalForecasted > 0 ? `incl. ${formatCents(summary.totalForecasted)} forecast` : 'vs total budget'}
            </p>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {summary.overCount > 0 ? (
                <XCircle className="h-4 w-4 text-red-600" />
              ) : summary.overspendingCount > 0 ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              Spending Speed
            </div>
            {summary.overCount > 0 ? (
              <>
                <p className="mt-1 text-xl font-bold text-red-600">Over Budget</p>
                <p className="text-xs text-muted-foreground">
                  {summary.overCount} {summary.overCount === 1 ? 'budget' : 'budgets'} exceeded
                  {summary.overspendingCount > 0 && `, ${summary.overspendingCount} overspending`}
                </p>
              </>
            ) : summary.overspendingCount > 0 ? (
              <>
                <p className="mt-1 text-xl font-bold text-amber-600">Slipping</p>
                <p className="text-xs text-muted-foreground">
                  {summary.overspendingCount} {summary.overspendingCount === 1 ? 'budget' : 'budgets'} overspending
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-xl font-bold text-green-600">On Track</p>
                <p className="text-xs text-muted-foreground">
                  {summary.watchCount > 0
                    ? `${summary.goodCount} on pace, ${summary.watchCount} to watch`
                    : `All ${summary.trackedCount} budgets on pace`}
                </p>
              </>
            )}
          </div>

          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {summary.untrackedSpent > 0 ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              Unbudgeted Spending
            </div>
            {summary.untrackedSpent > 0 ? (
              <>
                <p className="mt-1 text-xl font-bold text-amber-600">
                  {formatCents(summary.untrackedSpent)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary.untrackedCount} {summary.untrackedCount === 1 ? 'category' : 'categories'} without budgets
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-xl font-bold text-green-600">All tracked</p>
                <p className="text-xs text-muted-foreground">
                  All spending has a budget
                </p>
              </>
            )}
          </div>

          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PiggyBank className="h-4 w-4 text-blue-600" />
              Projected Savings
            </div>
            <p className="mt-1 text-xl font-bold text-blue-600">
              +{formatCents(summary.totalSavingsForecasted)}
            </p>
            <p className="text-xs text-muted-foreground">
              Forecast total of {formatCents(summary.totalSavingsProjected)}
            </p>
          </div>
        </div>
      )}

      {activeCategories.length === 0 ? (
        <div className="mt-8 space-y-4">
          <Alert variant="info">
            Budgets help you set spending limits for each category. Create categories to set up your budget.
          </Alert>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground">No categories found.</p>
            <Button className="mt-4" onClick={() => setAddDialogOpen(true)}>
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
            Spent amounts are calculated for each budget&apos;s cadence period (e.g., weekly budgets show this week&apos;s spending).
          </p>
        </div>
      )}

      <CategoryBudgetDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        scenarioId={activeScenarioId}
      />
    </div>
  );
}
