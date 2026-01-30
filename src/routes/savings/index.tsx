import { useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Plus, Pencil, Trash2, PiggyBank, Ambulance } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useTransactions } from '@/hooks/use-transactions';
import { useReportsData } from '@/hooks/use-reports-data';
import { SavingsGoalDialog } from '@/components/dialogs/savings-goal-dialog';
import { SavingsGoalProgressCard } from '@/components/charts';
import type { SavingsGoal } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

export function SavingsIndexPage() {
  const { activeScenarioId, startDate, endDate } = useOutletContext<OutletContext>();
  const { savingsGoals, isLoading: savingsLoading, addSavingsGoal, updateSavingsGoal, deleteSavingsGoal } = useSavingsGoals();
  const { savingsTransactions, isLoading: transactionsLoading, addTransaction } = useTransactions(startDate, endDate);
  const { savingsByGoal, isLoading: reportsLoading } = useReportsData(activeScenarioId, startDate, endDate);

  const isLoading = savingsLoading || transactionsLoading || reportsLoading;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Map goalId to SavingsGoal for editing
  const goalMap = useMemo(() => {
    const map: Record<string, SavingsGoal> = {};
    for (const goal of savingsGoals) {
      map[goal.id] = goal;
    }
    return map;
  }, [savingsGoals]);

  const openAddDialog = useCallback(() => {
    setEditingGoal(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((goalId: string) => {
    const goal = goalMap[goalId];
    if (goal) {
      setEditingGoal(goal);
      setDialogOpen(true);
    }
  }, [goalMap]);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingGoal(null);
    }
  }, []);

  const handleDelete = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
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
    (id: string, isEmergencyFund: boolean, e: React.MouseEvent) => {
      e.stopPropagation();
      updateSavingsGoal(id, { isEmergencyFund });
    },
    [updateSavingsGoal],
  );

  // Check if savings goal has transactions
  const getTransactionCount = useCallback(
    (goalId: string) => savingsTransactions.filter((t) => t.savingsGoalId === goalId).length,
    [savingsTransactions],
  );

  const hasTransactions = useCallback(
    (goalId: string) => getTransactionCount(goalId) > 0,
    [getTransactionCount],
  );

  return (
    <div className="page-shell">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <PiggyBank className="h-5 w-5 text-slate-500" />
            </div>
            Savings
          </h1>
          <p className="page-description">Track progress toward your savings targets.</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4" />
          Add Goal
        </Button>
      </div>

      {isLoading ? (
        <PageLoading />
      ) : savingsGoals.length === 0 ? (
        <div className="space-y-4">
          <Alert variant="info">
            Set goals for emergencies, holidays, or big purchases and watch your savings grow.
          </Alert>
          <div className="empty-state">
            <p className="empty-state-text">No savings goals yet.</p>
            <Button className="empty-state-action" onClick={openAddDialog}>
              Create your first goal
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {savingsByGoal.map((goal) => {
            const savingsGoal = goalMap[goal.goalId];
            const isDeleting = deletingId === goal.goalId;

            return (
              <div key={goal.goalId} className="group relative">
                <button
                  type="button"
                  onClick={() => openEditDialog(goal.goalId)}
                  className="w-full cursor-pointer text-left transition-shadow hover:ring-2 hover:ring-primary/20 focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                >
                  <SavingsGoalProgressCard
                    goalName={goal.goalName}
                    targetAmount={goal.targetAmount}
                    currentBalance={goal.currentBalance}
                    deadline={goal.deadline}
                    annualInterestRate={goal.annualInterestRate}
                    monthlySavings={goal.monthlySavings}
                  />
                </button>

                {/* Action buttons overlay */}
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => handleSetEmergencyFund(goal.goalId, !savingsGoal?.isEmergencyFund, e)}
                    aria-label={savingsGoal?.isEmergencyFund ? 'Remove as emergency fund' : 'Set as emergency fund'}
                  >
                    <Ambulance className={`h-3.5 w-3.5 ${savingsGoal?.isEmergencyFund ? 'text-blue-600' : ''}`} />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog(goal.goalId);
                    }}
                    aria-label="Edit goal"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={isDeleting ? 'destructive' : 'secondary'}
                    size="sm"
                    className="h-7 p-0 px-2"
                    onClick={(e) => handleDelete(goal.goalId, e)}
                    onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                    aria-label={isDeleting ? 'Confirm delete' : 'Delete goal'}
                    title={isDeleting && hasTransactions(goal.goalId) ? `Warning: Has ${getTransactionCount(goal.goalId)} transaction(s)` : undefined}
                  >
                    {isDeleting ? (
                      <span className="text-xs">{hasTransactions(goal.goalId) ? 'Delete?' : 'Confirm'}</span>
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
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
