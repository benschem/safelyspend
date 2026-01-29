import { useState, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus, Pencil, Trash2, Check, X, Archive, ArchiveRestore, Settings2, Tags } from 'lucide-react';
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

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
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

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const saveEdit = (id: string) => {
    if (!editName.trim()) return;
    updateCategory(id, { name: editName.trim() });
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = (id: string) => {
    if (deletingId === id) {
      deleteCategory(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
    }
  };

  const columns: ColumnDef<Category>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
        cell: ({ row }) => {
          const category = row.original;
          const isEditing = editingId === category.id;

          if (isEditing) {
            return (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 w-48"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(category.id);
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- Expected behaviour when entering edit mode
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={() => saveEdit(category.id)} title="Save">
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} title="Cancel">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          }

          return <span className="font-medium">{category.name}</span>;
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
          const isEditing = editingId === category.id;
          const isDeleting = deletingId === category.id;
          const isArchived = category.isArchived;

          if (isEditing) return null;

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditing(category.id, category.name)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateCategory(category.id, { isArchived: !isArchived })}
                title={isArchived ? 'Restore' : 'Archive'}
              >
                {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
              <Button
                variant={isDeleting ? 'destructive' : 'ghost'}
                size="sm"
                onClick={() => handleDelete(category.id)}
                onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                title={isDeleting ? 'Click again to confirm' : 'Delete'}
              >
                {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        },
      },
    ],
    [editingId, editName, deletingId, updateCategory, transactionCounts, forecastCounts],
  );

  return (
    <div>
      <div className="mb-20 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Tags className="h-7 w-7" />
            Categories
          </h1>
          <p className="mt-1 text-muted-foreground">Organise your expenses by category.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button onClick={() => setAddDialogOpen(true)}>
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
        <div className="mt-4 space-y-4">
          <Alert variant="info">
            Create categories like groceries, transport, or entertainment to see where your money goes.
          </Alert>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground">No categories yet.</p>
            <Button onClick={() => setAddDialogOpen(true)} className="mt-4">
              Add your first category
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
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
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        category={null}
        addCategory={addCategory}
        updateCategory={updateCategory}
      />
    </div>
  );
}
