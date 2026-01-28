import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus, Eye } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { ScenarioDialog } from '@/components/dialogs/scenario-dialog';
import { formatDate } from '@/lib/utils';
import type { Scenario } from '@/lib/types';

export function ScenariosIndexPage() {
  const { scenarios } = useScenarios();
  const [dialogOpen, setDialogOpen] = useState(false);

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
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" asChild title="View">
              <Link to={`/scenarios/${row.original.id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scenarios</h1>
          <p className="text-muted-foreground">
            Create and manage budget scenarios for what-if planning.
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Scenario
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No scenarios yet.</p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>
            Create your first scenario
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

      <ScenarioDialog open={dialogOpen} onOpenChange={setDialogOpen} scenario={null} />
    </div>
  );
}
