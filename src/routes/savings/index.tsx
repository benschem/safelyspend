import { useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus, Pencil, Trash2, PiggyBank, Ambulance } from 'lucide-react';
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
  const { savingsGoals, addSavingsGoal, updateSavingsGoal, deleteSavingsGoal } = useSavingsGoals();
  const { savingsTransactions, addTransaction } = useTransactions(startDate, endDate);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getSavedAmount = useCallback(
    (goalId: string) =>
      savingsTransactions
        .filter((t) => t.savingsGoalId === goalId)
        .reduce((sum, t) => sum + t.amountCents, 0),
    [savingsTransactions],
  );

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
    [savingsGoals, getSavedAmount],
  );

  const openAddDialog = useCallback(() => {
    setEditingGoal(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((goal: SavingsGoal) => {
    setEditingGoal(goal);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingGoal(null);
    }
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if (deletingId === id) {
        deleteSavingsGoal(id);
        setDeletingId(null);
      } else {
        setDeletingId(id);
      }
    },
    [deletingId, deleteSavingsGoal],
  );

  const handleSetEmergencyFund = useCallback(
    (id: string, isEmergencyFund: boolean) => {
      updateSavingsGoal(id, { isEmergencyFund });
    },
    [updateSavingsGoal],
  );

  const columns: ColumnDef<SavingsGoalRow>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
        cell: ({ row }) => {
          const goal = row.original;
          return (
            <button
              type="button"
              onClick={() => openEditDialog(goal)}
              className="cursor-pointer text-left font-medium hover:underline"
            >
              {goal.name}
            </button>
          );
        },
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
        accessorKey: 'annualInterestRate',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Interest
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const rate = row.original.annualInterestRate;
          return (
            <div className="text-right text-muted-foreground">
              {rate ? `${rate}%` : '-'}
            </div>
          );
        },
      },
      {
        accessorKey: 'progress',
        header: ({ column }) => <SortableHeader column={column}>Progress</SortableHeader>,
        cell: ({ row }) => {
          const progress = row.getValue('progress') as number;
          return (
            <div className="flex items-center gap-2">
              <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
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
        cell: ({ row }) => {
          const goal = row.original;
          const isDeleting = deletingId === goal.id;

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSetEmergencyFund(goal.id, !goal.isEmergencyFund)}
                aria-label={goal.isEmergencyFund ? 'Remove as emergency fund' : 'Set as emergency fund'}
              >
                <Ambulance className={`h-4 w-4 ${goal.isEmergencyFund ? 'text-blue-600' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(goal)}
                aria-label="Edit goal"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant={isDeleting ? 'destructive' : 'ghost'}
                size="sm"
                onClick={() => handleDelete(goal.id)}
                onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                aria-label={isDeleting ? 'Confirm delete' : 'Delete goal'}
              >
                {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        },
      },
    ],
    [deletingId, openEditDialog, handleDelete, handleSetEmergencyFund],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500/10">
              <PiggyBank className="h-5 w-5 text-slate-500" />
            </div>
            Savings
          </h1>
          <p className="mt-1 text-muted-foreground">Track progress toward your savings targets.</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4" />
          Add Goal
        </Button>
      </div>

      {savingsGoals.length === 0 ? (
        <div className="space-y-4">
          <Alert variant="info">
            Set goals for emergencies, holidays, or big purchases and watch your savings grow.
          </Alert>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground">No savings goals yet.</p>
            <Button className="mt-4" onClick={openAddDialog}>
              Create your first goal
            </Button>
          </div>
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

      <SavingsGoalDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        goal={editingGoal}
        addSavingsGoal={addSavingsGoal}
        updateSavingsGoal={updateSavingsGoal}
        addTransaction={addTransaction}
      />
    </div>
  );
}
