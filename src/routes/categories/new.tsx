import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { useCategories } from '@/hooks/use-categories';

export function CategoryNewPage() {
  const navigate = useNavigate();
  const { addCategory } = useCategories();

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const category = addCategory({
      name: name.trim(),
      isArchived: false,
    });

    navigate(`/categories/${category.id}`);
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

      <h1 className="text-2xl font-bold">New Category</h1>
      <p className="text-muted-foreground">Create a new expense category.</p>

      {error && <div className="mt-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Category Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Groceries, Rent, Entertainment"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit">Create Category</Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/categories">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
