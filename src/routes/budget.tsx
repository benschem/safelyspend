import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Switch } from '@/components/ui/switch';
import { Pencil, Trash2, Plus, Target } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useScenarios } from '@/hooks/use-scenarios';
import { ScenarioSelector } from '@/components/scenario-selector';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useCategories } from '@/hooks/use-categories';
import { useForecasts } from '@/hooks/use-forecasts';
import { CategoryBudgetDialog } from '@/components/dialogs/category-budget-dialog';
import { BudgetRuleDialog } from '@/components/dialogs/budget-rule-dialog';
import { formatCents } from '@/lib/utils';
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
  budgetAmount: number;
  cadence: Cadence | null;
  rule: BudgetRule | null;
}

const CADENCE_LABELS: Record<Cadence, string> = {
  weekly: '/wk',
  fortnightly: '/fn',
  monthly: '/mo',
  quarterly: '/qtr',
  yearly: '/yr',
};

export function BudgetPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { activeCategories, isLoading: categoriesLoading, addCategory } = useCategories();
  const { getRuleForCategory, isLoading: budgetLoading, setBudgetForCategory, deleteBudgetRule } =
    useBudgetRules(activeScenarioId);

  const isLoading = categoriesLoading || budgetLoading;

  // Get current month range for savings forecasts in breakdown chart
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { savingsForecasts } = useForecasts(activeScenarioId, monthStart, monthEnd);

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<BudgetRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hiddenSegments, setHiddenSegments] = useState<Set<string>>(new Set());

  const allRows: BudgetRow[] = useMemo(() => {
    return activeCategories
      .map((category) => {
        const rule = getRuleForCategory(category.id);
        return {
          id: category.id,
          categoryId: category.id,
          categoryName: category.name,
          budgetAmount: rule?.amountCents ?? 0,
          cadence: rule?.cadence ?? null,
          rule,
        };
      })
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }, [activeCategories, getRuleForCategory]);

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

    // Always include savings if there are any
    const monthlySavings = savingsForecasts.reduce((sum, f) => sum + f.amountCents, 0);
    if (monthlySavings > 0) {
      categorySegments.push({
        id: 'savings',
        name: 'Savings',
        amount: monthlySavings,
      });
    }

    return categorySegments;
  }, [allRows, savingsForecasts]);

  const hasSavingsSegment = budgetBreakdownSegments.some((s) => s.id === 'savings');
  const showSavingsInChart = !hiddenSegments.has('savings');

  const handleSegmentToggle = useCallback((id: string) => {
    setHiddenSegments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSavingsToggle = useCallback((checked: boolean) => {
    setHiddenSegments((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.delete('savings');
      } else {
        next.add('savings');
      }
      return next;
    });
  }, []);

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
            <Link
              to={`/categories/${budgetRow.categoryId}`}
              className="font-medium hover:underline"
            >
              {budgetRow.categoryName}
            </Link>
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
                className="cursor-pointer text-right text-sm text-muted-foreground hover:text-foreground"
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
              <Target className="h-5 w-5 text-slate-500" />
            </div>
            Budget
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
              <Target className="h-5 w-5 text-slate-500" />
            </div>
            Budget
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
        <div className="rounded-xl border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold">Breakdown</h2>
            <p className="text-sm text-muted-foreground">How your budget is split across categories</p>
          </div>
          <div className="mt-4">
            <SpendingBreakdownChart
              segments={budgetBreakdownSegments}
              total={budgetBreakdownTotal}
              colorMap={categoryColorMap}
              hiddenSegmentIds={hiddenSegments}
              onSegmentToggle={handleSegmentToggle}
            />
          </div>
          {hasSavingsSegment && (
            <div className="mt-4 flex items-center justify-end">
              <label htmlFor="compare-savings" className="flex items-center gap-2 text-sm">
                <Switch
                  id="compare-savings"
                  checked={showSavingsInChart}
                  onCheckedChange={handleSavingsToggle}
                />
                <span className="text-muted-foreground">Include Savings</span>
              </label>
            </div>
          )}
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
            data={allRows}
            searchKey="categoryName"
            searchPlaceholder="Search categories..."
            showPagination={false}
          />
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
