import { useState, useMemo, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Settings2, Tags } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useCategories } from '@/hooks/use-categories';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { CategoryDialog } from '@/components/dialogs/category-dialog';
import type { Category } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
}

export function CategoriesIndexPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { categories, isLoading: categoriesLoading, addCategory, updateCategory, deleteCategory } = useCategories();
  const { allTransactions, isLoading: transactionsLoading } = useTransactions();
  const { rules: forecastRules, isLoading: forecastsLoading } = useForecasts(activeScenarioId);

  // Combined loading state from all data hooks
  const isLoading = categoriesLoading || transactionsLoading || forecastsLoading;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
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

  // Sort categories: active first, then archived
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => Number(a.isArchived) - Number(b.isArchived)),
    [categories],
  );

  const openAddDialog = useCallback(() => {
    setEditingCategory(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((category: Category) => {
    setEditingCategory(category);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingCategory(null);
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (deletingId === id) {
      deleteCategory(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
    }
  }, [deletingId, deleteCategory]);

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
    if (fcCount > 0) parts.push(`${fcCount} forecast${fcCount !== 1 ? 's' : ''}`);
    return parts.join(' and ');
  }, [transactionCounts, forecastCounts]);

  const columns: ColumnDef<Category>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
        cell: ({ row }) => {
          const category = row.original;
          return (
            <Link
              to={`/categories/${category.id}`}
              className="font-medium hover:underline"
            >
              {category.name}
            </Link>
          );
        },
      },
      {
        accessorKey: 'isArchived',
        header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
        cell: ({ row }) =>
          row.getValue('isArchived') ? (
            <Badge variant="secondary">Archived</Badge>
          ) : null,
      },
      {
        id: 'transactions',
        header: () => <div className="text-center">Transactions</div>,
        cell: ({ row }) => {
          const count = transactionCounts[row.original.id] ?? 0;
          if (count === 0) {
            return <div className="text-center text-muted-foreground">—</div>;
          }
          return (
            <div className="text-center">
              <Link
                to={`/transactions?category=${row.original.id}`}
                className="hover:underline"
              >
                {count}
              </Link>
            </div>
          );
        },
      },
      {
        id: 'forecasts',
        header: () => <div className="text-center">Forecasts</div>,
        cell: ({ row }) => {
          const count = forecastCounts[row.original.id] ?? 0;
          if (count === 0) {
            return <div className="text-center text-muted-foreground">—</div>;
          }
          return (
            <div className="text-center">
              <Link
                to={`/forecasts?category=${row.original.id}`}
                className="hover:underline"
              >
                {count}
              </Link>
            </div>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const category = row.original;
          const isDeleting = deletingId === category.id;
          const isArchived = category.isArchived;

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(category)}
                aria-label="Edit category"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateCategory(category.id, { isArchived: !isArchived })}
                aria-label={isArchived ? 'Restore category' : 'Archive category'}
              >
                {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
              {hasReferences(category.id) ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        className="pointer-events-none"
                        aria-label="Delete category (disabled)"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Archive instead — used by {getReferenceText(category.id)}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant={isDeleting ? 'destructive' : 'ghost'}
                  size="sm"
                  onClick={() => handleDelete(category.id)}
                  onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                  aria-label={isDeleting ? 'Confirm delete' : 'Delete category'}
                >
                  {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [deletingId, updateCategory, transactionCounts, forecastCounts, openEditDialog, handleDelete, hasReferences, getReferenceText],
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
          <p className="page-description">Organise your expenses by category.</p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/categories/import-rules">
              <Settings2 className="h-4 w-4" />
              Manage Import Rules
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <PageLoading />
      ) : categories.length === 0 ? (
        <div className="space-y-4">
          <Alert variant="info">
            Create categories like groceries, transport, or entertainment to see where your money goes.
          </Alert>
          <div className="empty-state">
            <p className="empty-state-text">No categories yet.</p>
            <Button onClick={openAddDialog} className="empty-state-action">
              Add your first category
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <DataTable
            columns={columns}
            data={sortedCategories}
            searchKey="name"
            searchPlaceholder="Search categories..."
            showPagination={false}
          />
        </div>
      )}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        category={editingCategory}
        addCategory={addCategory}
        updateCategory={updateCategory}
      />
    </div>
  );
}
