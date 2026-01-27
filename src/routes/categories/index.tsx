import { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useCategories } from '@/hooks/use-categories';
import type { Category } from '@/lib/types';

export function CategoriesIndexPage() {
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();

  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeCategories = useMemo(() => categories.filter((c) => !c.isArchived), [categories]);
  const archivedCategories = useMemo(() => categories.filter((c) => c.isArchived), [categories]);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    addCategory({
      name: newCategoryName.trim(),
      isArchived: false,
    });
    setNewCategoryName('');
  };

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

  const createColumns = (isArchived: boolean): ColumnDef<Category>[] => [
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
                autoFocus
              />
              <Button size="sm" variant="ghost" onClick={() => saveEdit(category.id)}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit}>
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
      header: 'Status',
      cell: ({ row }) =>
        row.getValue('isArchived') ? (
          <Badge variant="secondary">Archived</Badge>
        ) : (
          <Badge variant="success">Active</Badge>
        ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const category = row.original;
        const isEditing = editingId === category.id;
        const isDeleting = deletingId === category.id;

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
            >
              {isArchived ? 'Restore' : 'Archive'}
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
  ];

  const activeColumns = useMemo(() => createColumns(false), [editingId, editName, deletingId]);
  const archivedColumns = useMemo(() => createColumns(true), [editingId, editName, deletingId]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground">Organize your expenses by category.</p>
        </div>
      </div>

      {/* Add new category inline */}
      <form onSubmit={handleAddCategory} className="mt-6 flex gap-2">
        <Input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="New category name..."
          className="max-w-xs"
        />
        <Button type="submit" disabled={!newCategoryName.trim()}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </form>

      {categories.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No categories yet. Add one above.</p>
        </div>
      ) : (
        <>
          {activeCategories.length > 0 && (
            <div className="mt-6">
              <DataTable
                columns={activeColumns}
                data={activeCategories}
                searchKey="name"
                searchPlaceholder="Search categories..."
                showPagination={false}
              />
            </div>
          )}

          {archivedCategories.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold text-muted-foreground">
                Archived Categories
              </h2>
              <div className="mt-4">
                <DataTable
                  columns={archivedColumns}
                  data={archivedCategories}
                  showPagination={false}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
