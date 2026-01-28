import { useState, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus, Eye } from 'lucide-react';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useTransactions } from '@/hooks/use-transactions';
import { SavingsGoalDialog } from '@/components/dialogs/savings-goal-dialog';
import { formatCents, formatDate } from '@/lib/utils';
import type { SavingsGoal } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

interface SavingsGoalRow extends SavingsGoal {
  savedAmount: number;
  progress: number;
}

export function SavingsIndexPage() {
  const { startDate, endDate } = useOutletContext<OutletContext>();
  const { savingsGoals } = useSavingsGoals();
  const { savingsTransactions } = useTransactions(startDate, endDate);
  const [dialogOpen, setDialogOpen] = useState(false);

  const getSavedAmount = (goalId: string) =>
    savingsTransactions
      .filter((t) => t.savingsGoalId === goalId)
      .reduce((sum, t) => sum + t.amountCents, 0);

  const getProgress = (current: number, target: number) => {
    if (target === 0) return 100;
    return Math.min(Math.round((current / target) * 100), 100);
  };

  const goalRows: SavingsGoalRow[] = useMemo(
    () =>
      savingsGoals.map((goal) => {
        const savedAmount = getSavedAmount(goal.id);
        return {
          ...goal,
          savedAmount,
          progress: getProgress(savedAmount, goal.targetAmountCents),
        };
      }),
    [savingsGoals, savingsTransactions],
  );

  const columns: ColumnDef<SavingsGoalRow>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
        cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span>,
      },
      {
        accessorKey: 'deadline',
        header: ({ column }) => <SortableHeader column={column}>Deadline</SortableHeader>,
        cell: ({ row }) => {
          const deadline = row.getValue('deadline') as string | undefined;
          return deadline ? formatDate(deadline) : '-';
        },
        sortingFn: 'datetime',
      },
      {
        accessorKey: 'progress',
        header: ({ column }) => <SortableHeader column={column}>Progress</SortableHeader>,
        cell: ({ row }) => {
          const progress = row.getValue('progress') as number;
          return (
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-2 rounded-full bg-blue-600"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="w-10 text-right text-sm text-muted-foreground">{progress}%</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'savedAmount',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Saved
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">{formatCents(row.getValue('savedAmount'))}</div>
        ),
      },
      {
        accessorKey: 'targetAmountCents',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Goal
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            {formatCents(row.getValue('targetAmountCents'))}
          </div>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" asChild title="View">
              <Link to={`/savings/${row.original.id}`}>
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
          <h1 className="text-2xl font-bold">Savings Goals</h1>
          <p className="text-muted-foreground">Track progress toward your savings targets.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Goal
        </Button>
      </div>

      {savingsGoals.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No savings goals yet.</p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>
            Create your first goal
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          <DataTable
            columns={columns}
            data={goalRows}
            searchKey="name"
            searchPlaceholder="Search goals..."
            showPagination={false}
          />
        </div>
      )}

      <SavingsGoalDialog open={dialogOpen} onOpenChange={setDialogOpen} goal={null} />
    </div>
  );
}
