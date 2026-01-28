import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Pencil, Check, X, Trash2, Plus, FolderTree } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { ScenarioSelector } from '@/components/scenario-selector';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useCategories } from '@/hooks/use-categories';
import { useTransactions } from '@/hooks/use-transactions';
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
  budgetAmount: number;
  cadence: Cadence | null;
  remaining: number;
  percentUsed: number;
  status: 'over' | 'warning' | 'good' | 'untracked';
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
 * Get display label for current period (full version for header)
 */
function getCurrentPeriodLabel(cadence: Cadence): string {
  const now = new Date();
  switch (cadence) {
    case 'weekly':
      return 'This week';
    case 'fortnightly':
      return 'This fortnight';
    case 'monthly':
      return now.toLocaleDateString('en-AU', { month: 'long' });
    case 'quarterly': {
      const quarter = Math.floor(now.getMonth() / 3) + 1;
      return `Q${quarter} ${now.getFullYear()}`;
    }
    case 'yearly':
      return String(now.getFullYear());
  }
}

/**
 * Get short period label for spent column
 */
function getShortPeriodLabel(cadence: Cadence): string {
  switch (cadence) {
    case 'weekly':
      return 'this week';
    case 'fortnightly':
      return 'this fortnight';
    case 'monthly':
      return 'this month';
    case 'quarterly':
      return 'this quarter';
    case 'yearly':
      return 'this year';
  }
}

function getStatus(percentUsed: number): 'over' | 'warning' | 'good' {
  if (percentUsed >= 100) return 'over';
  if (percentUsed >= 90) return 'warning';
  return 'good';
}

function getProgressColor(percentUsed: number): string {
  if (percentUsed >= 100) return 'bg-red-500';
  if (percentUsed >= 90) return 'bg-amber-500';
  if (percentUsed >= 75) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getStatusTextColor(status: 'over' | 'warning' | 'good' | 'untracked'): string {
  switch (status) {
    case 'over':
      return 'text-red-600';
    case 'warning':
      return 'text-amber-600';
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
  const { allTransactions } = useTransactions();
  const { getRuleForCategory, setBudgetForCategory, deleteBudgetRule } =
    useBudgetRules(activeScenarioId);

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

      const remaining = budgetAmount - spent;
      const percentUsed = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
      const status: BudgetRow['status'] = !rule
        ? 'untracked'
        : getStatus(percentUsed);

      return {
        id: category.id,
        categoryId: category.id,
        categoryName: category.name,
        spent,
        budgetAmount,
        cadence,
        remaining,
        percentUsed,
        status,
        rule,
      };
    });
  }, [activeCategories, getRuleForCategory, categorySpending]);

  // Sort: over first, then warning, then good, then untracked
  const sortedRows = useMemo(() => {
    const statusOrder = { over: 0, warning: 1, good: 2, untracked: 3 };
    return [...allRows].sort((a, b) => {
      const orderDiff = statusOrder[a.status] - statusOrder[b.status];
      if (orderDiff !== 0) return orderDiff;
      // Within same status, sort by percent used descending
      return b.percentUsed - a.percentUsed;
    });
  }, [allRows]);

  // Calculate summary stats
  const summary = useMemo(() => {
    const tracked = allRows.filter((r) => r.rule);
    const totalSpent = tracked.reduce((sum, r) => sum + r.spent, 0);
    const totalBudget = tracked.reduce((sum, r) => sum + r.budgetAmount, 0);
    const totalRemaining = totalBudget - totalSpent;
    const overCount = tracked.filter((r) => r.status === 'over').length;
    const warningCount = tracked.filter((r) => r.status === 'warning').length;
    const goodCount = tracked.filter((r) => r.status === 'good').length;
    const untrackedCount = allRows.filter((r) => !r.rule).length;

    return {
      totalSpent,
      totalBudget,
      totalRemaining,
      overCount,
      warningCount,
      goodCount,
      untrackedCount,
      trackedCount: tracked.length,
    };
  }, [allRows]);

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
                  : row.original.status === 'warning'
                    ? 'bg-amber-500'
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
          const periodLabel = budgetRow.cadence ? getShortPeriodLabel(budgetRow.cadence) : 'this month';
          return (
            <div className="text-right">
              <div className="font-mono">{formatCents(row.getValue('spent'))}</div>
              <div className="text-xs text-muted-foreground">{periodLabel}</div>
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
        accessorKey: 'remaining',
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
          return (
            <div className={`text-right font-mono ${getStatusTextColor(budgetRow.status)}`}>
              {budgetRow.remaining >= 0 ? '+' : ''}
              {formatCents(budgetRow.remaining)}
            </div>
          );
        },
      },
      {
        accessorKey: 'percentUsed',
        header: ({ column }) => <SortableHeader column={column}>Progress</SortableHeader>,
        cell: ({ row }) => {
          const budgetRow = row.original;
          if (!budgetRow.rule) {
            return <div className="text-muted-foreground">—</div>;
          }
          const percent = Math.min(budgetRow.percentUsed, 100);
          const displayPercent = Math.round(budgetRow.percentUsed);
          return (
            <div className="flex items-center gap-2">
              <div className="h-2 w-full min-w-[80px] rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={`h-2 rounded-full transition-all ${getProgressColor(budgetRow.percentUsed)}`}
                  style={{ width: `${percent}%` }}
                />
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

  // Get current period label (use monthly as default for header)
  const periodLabel = getCurrentPeriodLabel('monthly');

  if (!activeScenarioId || !activeScenario) {
    return (
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold">
              <FolderTree className="h-7 w-7" />
              Budgets
            </h1>
            <p className="mt-1 text-muted-foreground">Track spending against your targets</p>
          </div>
        </div>
        <div className="mt-6">
          <ScenarioSelector />
        </div>
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Select a scenario to view budgets.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <FolderTree className="h-7 w-7" />
            Budgets
          </h1>
          <p className="mt-1 text-muted-foreground">Track spending against your targets</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      <div className="mt-6">
        <ScenarioSelector />
      </div>

      {/* Summary Card */}
      {summary.trackedCount > 0 && (
        <div className="mt-6 rounded-lg border bg-card p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-muted-foreground">{periodLabel}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold">{formatCents(summary.totalSpent)}</span>
                <span className="text-muted-foreground">of {formatCents(summary.totalBudget)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              {summary.overCount > 0 && (
                <span className="text-red-600">{summary.overCount} over budget</span>
              )}
              {summary.warningCount > 0 && (
                <span className="text-amber-600">{summary.warningCount} near limit</span>
              )}
              {summary.goodCount > 0 && (
                <span className="text-green-600">{summary.goodCount} on track</span>
              )}
              {summary.untrackedCount > 0 && (
                <span className="text-muted-foreground">{summary.untrackedCount} untracked</span>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-2 rounded-full transition-all ${
                  summary.totalRemaining < 0
                    ? 'bg-red-500'
                    : summary.totalSpent / summary.totalBudget >= 0.9
                      ? 'bg-amber-500'
                      : 'bg-green-500'
                }`}
                style={{
                  width: `${Math.min((summary.totalSpent / summary.totalBudget) * 100, 100)}%`,
                }}
              />
            </div>
            <span
              className={`text-sm font-medium ${
                summary.totalRemaining >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {summary.totalRemaining >= 0 ? '+' : ''}
              {formatCents(summary.totalRemaining)} remaining
            </span>
          </div>
        </div>
      )}

      {activeCategories.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No categories found.</p>
          <Button asChild className="mt-4">
            <Link to="/categories">Add your first category</Link>
          </Button>
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
