import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { useCategories } from '@/hooks/use-categories';

export function CategoriesIndexPage() {
  const { categories, updateCategory } = useCategories();

  const activeCategories = categories.filter((c) => !c.isArchived);
  const archivedCategories = categories.filter((c) => c.isArchived);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground">Organize your expenses by category.</p>
        </div>
        <Button asChild>
          <Link to="/categories/new">
            <Plus className="h-4 w-4" />
            Add Category
          </Link>
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No categories yet.</p>
          <Button asChild className="mt-4">
            <Link to="/categories/new">Create your first category</Link>
          </Button>
        </div>
      ) : (
        <>
          {activeCategories.length > 0 && (
            <Table className="mt-6">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      <Link to={`/categories/${category.id}`} className="hover:underline">
                        {category.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success">Active</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateCategory(category.id, { isArchived: true })}
                        >
                          Archive
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/categories/${category.id}`}>View</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {archivedCategories.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold text-muted-foreground">
                Archived Categories
              </h2>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedCategories.map((category) => (
                    <TableRow key={category.id} className="opacity-60">
                      <TableCell className="font-medium">
                        <Link to={`/categories/${category.id}`} className="hover:underline">
                          {category.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Archived</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateCategory(category.id, { isArchived: false })}
                          >
                            Restore
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/categories/${category.id}`}>View</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </>
      )}
    </div>
  );
}
