import { useState, useMemo, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Settings2, Tags } from 'lucide-react';
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
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();
  const { allTransactions } = useTransactions();
  const { rules: forecastRules } = useForecasts(activeScenarioId);

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
            <button
              type="button"
              onClick={() => openEditDialog(category)}
              className="cursor-pointer text-left font-medium hover:underline"
            >
              {category.name}
            </button>
          );
        },
      },
      {
        accessorKey: 'isArchived',
        header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
        cell: ({ row }) =>
          row.getValue('isArchived') ? (
            <Badge variant="secondary">Archived</Badge>
          ) : (
            <Badge variant="success">Active</Badge>
          ),
      },
      {
        id: 'transactions',
        header: 'Transactions',
        cell: ({ row }) => {
          const count = transactionCounts[row.original.id] ?? 0;
          if (count === 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <Link
              to={`/transactions?category=${row.original.id}`}
              className="hover:underline"
            >
              {count}
            </Link>
          );
        },
      },
      {
        id: 'forecasts',
        header: 'Forecasts',
        cell: ({ row }) => {
          const count = forecastCounts[row.original.id] ?? 0;
          if (count === 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <Link
              to={`/forecasts?category=${row.original.id}`}
              className="hover:underline"
            >
              {count}
            </Link>
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
              <Button
                variant={isDeleting ? 'destructive' : 'ghost'}
                size="sm"
                onClick={() => handleDelete(category.id)}
                onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                aria-label={isDeleting ? 'Confirm delete' : 'Delete category'}
                title={isDeleting && hasReferences(category.id) ? `Warning: Used by ${getReferenceText(category.id)}` : undefined}
              >
                {isDeleting ? (hasReferences(category.id) ? 'Delete anyway?' : 'Confirm') : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        },
      },
    ],
    [deletingId, updateCategory, transactionCounts, forecastCounts, openEditDialog, handleDelete, hasReferences, getReferenceText],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500/10">
              <Tags className="h-5 w-5 text-slate-500" />
            </div>
            Categories
          </h1>
          <p className="mt-1 text-muted-foreground">Organise your expenses by category.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
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

      {categories.length === 0 ? (
        <div className="space-y-4">
          <Alert variant="info">
            Create categories like groceries, transport, or entertainment to see where your money goes.
          </Alert>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground">No categories yet.</p>
            <Button onClick={openAddDialog} className="mt-4">
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
