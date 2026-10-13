import { useState, useMemo, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Pencil, Trash2, Archive, ArchiveRestore, Settings2, Tags } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useCategories } from '@/hooks/use-categories';
import { useTransactions } from '@/hooks/use-transactions';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useForecasts } from '@/hooks/use-forecasts';
import { useUndoDelete } from '@/hooks/use-undo-delete';
import { CategoryDialog } from '@/components/dialogs/category-dialog';
import { allowancesForCategory, sumAllowancesForPeriod } from '@/lib/allowances';
import { formatCents, pluralise } from '@/lib/utils';
import type { BudgetRule, Category } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
}

/**
 * One table row: a category and everything that uses it. The page is for
 * housekeeping, so each column answers "is this category in use, and by what".
 */
interface CategoryRow {
  category: Category;
  name: string;
  isArchived: boolean;
  transactionCount: number;
  allowances: BudgetRule[];
  fixedExpenseCount: number;
}

/**
 * What a category is used by, as a phrase for the disabled delete tooltip.
 * Empty when nothing uses it, which is what makes it safe to delete.
 */
function describeUsage(row: CategoryRow): string {
  const parts: string[] = [];
  if (row.transactionCount > 0) parts.push(pluralise(row.transactionCount, 'transaction'));
  if (row.fixedExpenseCount > 0) parts.push(pluralise(row.fixedExpenseCount, 'bill'));
  if (row.allowances.length > 0) parts.push(pluralise(row.allowances.length, 'allowance'));
  return parts.join(', ');
}

export function CategoriesIndexPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const {
    categories,
    isLoading: categoriesLoading,
    addCategory,
    updateCategory,
    deleteCategory,
    restoreCategory,
  } = useCategories();
  const { allTransactions, isLoading: transactionsLoading } = useTransactions();
  const { budgetRules, isLoading: budgetLoading } = useBudgetRules(activeScenarioId);
  const { rules: forecastRules, isLoading: forecastsLoading } = useForecasts(activeScenarioId);

  const isLoading = categoriesLoading || transactionsLoading || budgetLoading || forecastsLoading;

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const undoDelete = useUndoDelete<Category>(deleteCategory, restoreCategory, 'Category');

  const transactionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const transaction of allTransactions) {
      if (transaction.categoryId) {
        counts[transaction.categoryId] = (counts[transaction.categoryId] ?? 0) + 1;
      }
    }
    return counts;
  }, [allTransactions]);

  const fixedExpenseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const rule of forecastRules) {
      if (rule.type === 'expense' && rule.categoryId) {
        counts[rule.categoryId] = (counts[rule.categoryId] ?? 0) + 1;
      }
    }
    return counts;
  }, [forecastRules]);

  // Active categories first, then archived, each group by name
  const rows = useMemo<CategoryRow[]>(
    () =>
      categories
        .map((category) => ({
          category,
          name: category.name,
          isArchived: category.isArchived,
          transactionCount: transactionCounts[category.id] ?? 0,
          allowances: allowancesForCategory(budgetRules, category.id),
          fixedExpenseCount: fixedExpenseCounts[category.id] ?? 0,
        }))
        .sort(
          (first, second) =>
            Number(first.isArchived) - Number(second.isArchived) ||
            first.name.localeCompare(second.name),
        ),
    [categories, transactionCounts, budgetRules, fixedExpenseCounts],
  );

  const handleDelete = useCallback(
    (category: Category) => undoDelete(category, `"${category.name}" deleted`),
    [undoDelete],
  );

  const columns: ColumnDef<CategoryRow>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
        cell: ({ row }) => (
          <Link
            to={`/categories/${row.original.category.id}`}
            className="font-medium hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'isArchived',
        header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
        cell: ({ row }) =>
          row.original.isArchived ? <Badge variant="secondary">Archived</Badge> : null,
      },
      {
        accessorKey: 'transactionCount',
        header: ({ column }) => <SortableHeader column={column}>Transactions</SortableHeader>,
        cell: ({ row }) => {
          const count = row.original.transactionCount;
          if (count === 0) {
            return <span className="text-muted-foreground">0</span>;
          }
          return (
            <Link
              to={`/transactions?category=${row.original.category.id}`}
              className="hover:underline"
            >
              {count}
            </Link>
          );
        },
      },
      {
        id: 'budget',
        header: 'Allowance',
        cell: ({ row }) => {
          const { allowances } = row.original;
          const [onlyAllowance] = allowances;
          if (!onlyAllowance) {
            return <span className="text-muted-foreground">None</span>;
          }
          // One allowance is quoted as it was entered. Several can run at
          // different frequencies, so they are quoted as a monthly total.
          return (
            <Link to="/budget" className="hover:underline">
              {allowances.length === 1
                ? `${formatCents(onlyAllowance.amountCents)} ${onlyAllowance.cadence}`
                : `${formatCents(sumAllowancesForPeriod(allowances, 'monthly'))} monthly, from ${allowances.length} allowances`}
            </Link>
          );
        },
      },
      {
        accessorKey: 'fixedExpenseCount',
        header: ({ column }) => <SortableHeader column={column}>Bills</SortableHeader>,
        cell: ({ row }) => {
          const count = row.original.fixedExpenseCount;
          if (count === 0) {
            return <span className="text-muted-foreground">0</span>;
          }
          return (
            <Link to="/budget" className="hover:underline">
              {count}
            </Link>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const { category, isArchived } = row.original;
          const usage = describeUsage(row.original);

          return (
            <TooltipProvider>
              <div className="flex justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingCategory(category)}
                      aria-label="Rename"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Rename</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateCategory(category.id, { isArchived: !isArchived })}
                      aria-label={isArchived ? 'Restore' : 'Archive'}
                    >
                      {isArchived ? (
                        <ArchiveRestore className="h-4 w-4" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isArchived ? 'Restore' : 'Archive'}</TooltipContent>
                </Tooltip>
                {usage ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* A disabled button fires no hover events, so the span carries the tooltip */}
                      <span className="inline-block">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          className="pointer-events-none"
                          aria-label="Delete (unavailable)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Archive instead. Used by {usage}.</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(category)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
          );
        },
      },
    ],
    [updateCategory, handleDelete],
  );

  return (
    <div className="page-shell">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <Tags className="h-5 w-5 text-slate-500" />
            </div>
            Categories
          </h1>
          <p className="page-description">
            Every category and what uses it. Rename, archive or delete them here.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/categories/import-rules">
            <Settings2 className="h-4 w-4" />
            Manage Import Rules
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <PageLoading />
      ) : categories.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">
            No categories yet. One is created when you add an allowance, a bill or a transaction.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchKey="name"
          searchPlaceholder="Search categories..."
          showPagination={false}
        />
      )}

      <CategoryDialog
        open={editingCategory !== null}
        onOpenChange={(open) => {
          if (!open) setEditingCategory(null);
        }}
        category={editingCategory}
        addCategory={addCategory}
        updateCategory={updateCategory}
      />
    </div>
  );
}
