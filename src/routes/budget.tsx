import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Pencil, Trash2, Plus, Target, Archive, ArchiveRestore, Settings2 } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useScenarios } from '@/hooks/use-scenarios';
import { ScenarioSelector } from '@/components/scenario-selector';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useCategories } from '@/hooks/use-categories';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { CategoryBudgetDialog } from '@/components/dialogs/category-budget-dialog';
import { formatCents } from '@/lib/utils';
import type { Cadence, BudgetRule, Category } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
}

interface BudgetRow {
  id: string;
  category: Category;
  categoryName: string;
  budgetAmount: number;
  cadence: Cadence | null;
  rule: BudgetRule | null;
  transactionCount: number;
  forecastCount: number;
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
  const { categories, isLoading: categoriesLoading, addCategory, updateCategory, deleteCategory } = useCategories();
  const { getRuleForCategory, isLoading: budgetLoading, setBudgetForCategory, deleteBudgetRule } =
    useBudgetRules(activeScenarioId);
  const { allTransactions, isLoading: transactionsLoading } = useTransactions();
  const { rules: forecastRules, isLoading: forecastsLoading } = useForecasts(activeScenarioId,
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
  );

  const isLoading = categoriesLoading || budgetLoading || transactionsLoading || forecastsLoading;

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<BudgetRow | null>(null);
  const [focusLimit, setFocusLimit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Compute transaction counts per category
  const transactionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of allTransactions) {
      if (t.categoryId) {
        counts[t.categoryId] = (counts[t.categoryId] ?? 0) + 1;
      }
    }
    return counts;
  }, [allTransactions]);

  // Compute forecast rule counts per category
  const forecastCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of forecastRules) {
      if (r.categoryId) {
        counts[r.categoryId] = (counts[r.categoryId] ?? 0) + 1;
      }
    }
    return counts;
  }, [forecastRules]);

  // Check if category has references (transactions or forecasts)
  const hasReferences = useCallback((id: string) => {
    return (transactionCounts[id] ?? 0) > 0 || (forecastCounts[id] ?? 0) > 0;
  }, [transactionCounts, forecastCounts]);

  // Get reference count text for warning
  const getReferenceText = useCallback((id: string) => {
    const txCount = transactionCounts[id] ?? 0;
    const fcCount = forecastCounts[id] ?? 0;
    const parts: string[] = [];
    if (txCount > 0) parts.push(`${txCount} transaction${txCount !== 1 ? 's' : ''}`);
    if (fcCount > 0) parts.push(`${fcCount} expected transaction${fcCount !== 1 ? 's' : ''}`);
    return parts.join(' and ');
  }, [transactionCounts, forecastCounts]);

  // Build rows from all categories (active first, then archived)
  const allRows: BudgetRow[] = useMemo(() => {
    return [...categories]
      .sort((a, b) => {
        // First sort by archived status
        if (a.isArchived !== b.isArchived) {
          return a.isArchived ? 1 : -1;
        }
        // Then by name
        return a.name.localeCompare(b.name);
      })
      .map((category) => {
        const rule = getRuleForCategory(category.id);
        return {
          id: category.id,
          category,
          categoryName: category.name,
          budgetAmount: rule?.amountCents ?? 0,
          cadence: rule?.cadence ?? null,
          rule,
          transactionCount: transactionCounts[category.id] ?? 0,
          forecastCount: forecastCounts[category.id] ?? 0,
        };
      });
  }, [categories, getRuleForCategory, transactionCounts, forecastCounts]);

  const openEditDialog = useCallback((row: BudgetRow, shouldFocusLimit = false) => {
    setEditingRow(row);
    setFocusLimit(shouldFocusLimit);
    setEditDialogOpen(true);
  }, []);

  const handleEditDialogClose = useCallback((open: boolean) => {
    setEditDialogOpen(open);
    if (!open) {
      setEditingRow(null);
      setFocusLimit(false);
    }
  }, []);

  const handleDelete = useCallback(
    (categoryId: string) => {
      if (deletingId === categoryId) {
        deleteCategory(categoryId);
        setDeletingId(null);
      } else {
        setDeletingId(categoryId);
      }
    },
    [deletingId, deleteCategory],
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
          const isArchived = budgetRow.category.isArchived;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={`/categories/${budgetRow.id}`}
                    className={`font-medium hover:underline ${isArchived ? 'text-muted-foreground' : ''}`}
                  >
                    {budgetRow.categoryName}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>View category details</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: 'isArchived',
        header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
        accessorFn: (row) => row.category.isArchived,
        cell: ({ row }) =>
          row.original.category.isArchived ? (
            <Badge variant="secondary">Archived</Badge>
          ) : null,
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
          const isArchived = budgetRow.category.isArchived;

          if (!budgetRow.rule) {
            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => openEditDialog(budgetRow, true)}
                      className={`cursor-pointer text-right text-sm hover:underline hover:text-foreground ${isArchived ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}
                    >
                      Set limit
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Set a spending limit for this category</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => openEditDialog(budgetRow, true)}
                    className={`cursor-pointer text-right font-mono hover:underline ${isArchived ? 'text-muted-foreground' : ''}`}
                  >
                    {formatCents(budgetRow.budgetAmount)}
                    <span className="text-muted-foreground">{CADENCE_LABELS[budgetRow.cadence!]}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Edit spending limit</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: 'transactionCount',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-center">
            Past Transactions
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const budgetRow = row.original;
          const count = budgetRow.transactionCount;
          const isArchived = budgetRow.category.isArchived;
          if (count === 0) {
            return <div className={`text-center ${isArchived ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>—</div>;
          }
          return (
            <div className="text-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={`/money?category=${budgetRow.id}&from=budget`}
                      className={`hover:underline ${isArchived ? 'text-muted-foreground' : ''}`}
                    >
                      {count}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>View past transactions in this category</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
      },
      {
        accessorKey: 'forecastCount',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-center">
            Expected Transactions
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const budgetRow = row.original;
          const count = budgetRow.forecastCount;
          const isArchived = budgetRow.category.isArchived;
          if (count === 0) {
            return <div className={`text-center ${isArchived ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>—</div>;
          }
          return (
            <div className="text-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={`/money?tab=expected&category=${budgetRow.id}&from=budget`}
                      className={`hover:underline ${isArchived ? 'text-muted-foreground' : ''}`}
                    >
                      {count}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>View expected transactions in this category</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const budgetRow = row.original;
          const isDeleting = deletingId === budgetRow.id;
          const isArchived = budgetRow.category.isArchived;

          return (
            <TooltipProvider>
              <div className="flex justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(budgetRow)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateCategory(budgetRow.id, { isArchived: !isArchived })}
                      aria-label={isArchived ? 'Restore' : 'Archive'}
                    >
                      {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isArchived ? 'Restore' : 'Archive'}</TooltipContent>
                </Tooltip>
                {hasReferences(budgetRow.id) ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          className="pointer-events-none"
                          aria-label="Delete (disabled)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Archive instead — used by {getReferenceText(budgetRow.id)}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isDeleting ? 'destructive' : 'ghost'}
                        size="sm"
                        onClick={() => handleDelete(budgetRow.id)}
                        onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                        aria-label={isDeleting ? 'Confirm delete' : 'Delete'}
                      >
                        {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isDeleting ? 'Click to confirm' : 'Delete'}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
          );
        },
      },
    ],
    [deletingId, openEditDialog, handleDelete, updateCategory, hasReferences, getReferenceText],
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
          <p className="page-description">Manage spending categories and set budget limits</p>
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
          <p className="page-description">Manage spending categories and set budget limits</p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <ScenarioSelector />
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/categories/import-rules">
              <Settings2 className="h-4 w-4" />
              Manage Import Rules
            </Link>
          </Button>
        </div>
      </div>

      <Alert variant="info" className="mb-6">
        Budgets set spending limits for each category. They vary by scenario.
      </Alert>

      {categories.length === 0 ? (
        <div className="mt-8 space-y-4">
          <Alert variant="info">
            Create categories like groceries, transport, or entertainment to see where your money goes.
          </Alert>
          <div className="empty-state">
            <p className="empty-state-text">No categories yet.</p>
            <Button className="empty-state-action" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add your first category
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

      {/* Add Category Dialog */}
      <CategoryBudgetDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        scenarioId={activeScenarioId}
        addCategory={addCategory}
        setBudgetForCategory={setBudgetForCategory}
      />

      {/* Edit Category Dialog */}
      {editingRow && (
        <CategoryBudgetDialog
          open={editDialogOpen}
          onOpenChange={handleEditDialogClose}
          scenarioId={activeScenarioId}
          category={editingRow.category}
          existingRule={editingRow.rule}
          focusLimit={focusLimit}
          addCategory={addCategory}
          updateCategory={updateCategory}
          setBudgetForCategory={setBudgetForCategory}
          deleteBudgetRule={deleteBudgetRule}
        />
      )}
    </div>
  );
}
