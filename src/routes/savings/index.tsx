import { useState, useMemo, useCallback, useEffect } from 'react';
import { useOutletContext } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus, Pencil, Trash2, Check, X, PiggyBank, Ambulance } from 'lucide-react';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useTransactions } from '@/hooks/use-transactions';
import { SavingsGoalDialog } from '@/components/dialogs/savings-goal-dialog';
import { formatCents, formatDate, parseCentsFromInput } from '@/lib/utils';
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

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
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

  const startEditing = useCallback((goal: SavingsGoal) => {
    setEditingId(goal.id);
    setEditName(goal.name);
    setEditTarget((goal.targetAmountCents / 100).toFixed(2));
    setEditDeadline(goal.deadline ?? '');
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditName('');
    setEditTarget('');
    setEditDeadline('');
  }, []);

  const saveEditing = useCallback(() => {
    if (!editingId || !editName.trim()) return;

    const targetCents = parseCentsFromInput(editTarget);
    if (targetCents <= 0) return;

    const updates: Parameters<typeof updateSavingsGoal>[1] = {
      name: editName.trim(),
      targetAmountCents: targetCents,
    };
    if (editDeadline) {
      updates.deadline = editDeadline;
    }
    updateSavingsGoal(editingId, updates);
    cancelEditing();
  }, [editingId, editName, editTarget, editDeadline, updateSavingsGoal, cancelEditing]);

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

  // Close editors on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) cancelEditing();
        if (deletingId) setDeletingId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingId, deletingId, cancelEditing]);

  const columns: ColumnDef<SavingsGoalRow>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
        cell: ({ row }) => {
          const goal = row.original;
          if (editingId === goal.id) {
            return (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 w-full min-w-[120px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEditing();
                  if (e.key === 'Escape') cancelEditing();
                }}
              />
            );
          }
          return <span className="font-medium">{goal.name}</span>;
        },
      },
      {
        accessorKey: 'deadline',
        header: ({ column }) => <SortableHeader column={column}>Deadline</SortableHeader>,
        cell: ({ row }) => {
          const goal = row.original;
          if (editingId === goal.id) {
            return (
              <Input
                type="date"
                value={editDeadline}
                onChange={(e) => setEditDeadline(e.target.value)}
                className="h-8 w-36"
              />
            );
          }
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
        cell: ({ row }) => {
          const goal = row.original;
          if (editingId === goal.id) {
            return (
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editTarget}
                onChange={(e) => setEditTarget(e.target.value)}
                className="h-8 w-24 text-right"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEditing();
                  if (e.key === 'Escape') cancelEditing();
                }}
              />
            );
          }
          return (
            <div className="text-right font-mono">
              {formatCents(row.getValue('targetAmountCents'))}
            </div>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const goal = row.original;
          const isEditing = editingId === goal.id;
          const isDeleting = deletingId === goal.id;

          if (isEditing) {
            return (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={saveEditing} title="Save">
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={cancelEditing} title="Cancel">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          }

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSetEmergencyFund(goal.id, !goal.isEmergencyFund)}
                title={goal.isEmergencyFund ? 'Remove as emergency fund' : 'Set as emergency fund'}
              >
                <Ambulance className={`h-4 w-4 ${goal.isEmergencyFund ? 'text-blue-600' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditing(goal)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant={isDeleting ? 'destructive' : 'ghost'}
                size="sm"
                onClick={() => handleDelete(goal.id)}
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
    [editingId, editName, editTarget, editDeadline, deletingId, startEditing, cancelEditing, saveEditing, handleDelete, handleSetEmergencyFund],
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
        <Button onClick={() => setDialogOpen(true)}>
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
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
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
        onOpenChange={setDialogOpen}
        goal={null}
        addSavingsGoal={addSavingsGoal}
        updateSavingsGoal={updateSavingsGoal}
        addTransaction={addTransaction}
      />
    </div>
  );
}
