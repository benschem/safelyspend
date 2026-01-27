import { useMemo } from 'react';
import { Link } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { formatDate } from '@/lib/utils';
import type { Scenario } from '@/lib/types';

export function ScenariosIndexPage() {
  const { scenarios } = useScenarios();

  const columns: ColumnDef<Scenario>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.getValue('name')}</span>
            {row.original.isDefault && <Badge variant="secondary">Default</Badge>}
          </div>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.getValue('description') || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <SortableHeader column={column}>Created</SortableHeader>,
        cell: ({ row }) => {
          const createdAt = row.getValue('createdAt') as string;
          const createdDate = createdAt?.split('T')[0];
          return createdDate ? formatDate(createdDate) : '-';
        },
        sortingFn: 'datetime',
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/manage/scenarios/${row.original.id}`}>View</Link>
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scenarios</h1>
          <p className="text-muted-foreground">
            Create and manage budget scenarios for what-if planning.
          </p>
        </div>
        <Button asChild>
          <Link to="/manage/scenarios/new">
            <Plus className="h-4 w-4" />
            New Scenario
          </Link>
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No scenarios yet.</p>
          <Button asChild className="mt-4">
            <Link to="/manage/scenarios/new">Create your first scenario</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          <DataTable
            columns={columns}
            data={scenarios}
            searchKey="name"
            searchPlaceholder="Search scenarios..."
            showPagination={false}
          />
        </div>
      )}
    </div>
  );
}
