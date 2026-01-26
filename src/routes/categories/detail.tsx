import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { useCategories } from '@/hooks/use-categories';

export function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { categories, updateCategory, deleteCategory } = useCategories();

  const category = categories.find((c) => c.id === id);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!category) {
    return (
      <div>
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/categories">
              <ArrowLeft className="h-4 w-4" />
              Back to Categories
            </Link>
          </Button>
        </div>
        <p className="text-muted-foreground">Category not found.</p>
      </div>
    );
  }

  const handleSave = () => {
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    updateCategory(category.id, { name: name.trim() });
    setEditing(false);
  };

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteCategory(category.id);
    navigate('/categories');
  };

  const handleToggleArchive = () => {
    updateCategory(category.id, { isArchived: !category.isArchived });
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/categories">
            <ArrowLeft className="h-4 w-4" />
            Back to Categories
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{category.name}</h1>
            {category.isArchived ? (
              <Badge variant="secondary">Archived</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={handleToggleArchive}>
          {category.isArchived ? 'Restore' : 'Archive'}
        </Button>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      <Separator className="my-6" />

      {/* Edit Section */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Category Details</h2>
          {!editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setName(category.name);
                setEditing(true);
              }}
            >
              Edit
            </Button>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave}>Save</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span> {category.name}
            </p>
            <p>
              <span className="text-muted-foreground">Status:</span>{' '}
              {category.isArchived ? 'Archived' : 'Active'}
            </p>
            <p>
              <span className="text-muted-foreground">Created:</span>{' '}
              {new Date(category.createdAt).toLocaleDateString('en-AU')}
            </p>
          </div>
        )}
      </section>

      <Separator className="my-6" />

      {/* Danger Zone */}
      <section>
        <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
        <div className="mt-4 rounded-lg border border-destructive/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Delete Category</h3>
              <p className="text-sm text-muted-foreground">
                Permanently delete this category. Associated transactions will have no category.
              </p>
            </div>
            <div className="flex gap-2">
              {confirmingDelete && (
                <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
              )}
              <Button variant="destructive" onClick={handleDelete}>
                {confirmingDelete ? 'Confirm Delete' : 'Delete Category'}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
