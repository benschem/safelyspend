import { useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Plus, PiggyBank, TrendingUp, Target, Clock } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useTransactions } from '@/hooks/use-transactions';
import { useReportsData } from '@/hooks/use-reports-data';
import { SavingsGoalDialog } from '@/components/dialogs/savings-goal-dialog';
import { SavingsGoalProgressCard } from '@/components/charts';
import { formatCents } from '@/lib/utils';
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

  // Map goalId to SavingsGoal for editing
  const goalMap = useMemo(() => {
    const map: Record<string, SavingsGoal> = {};
    for (const goal of savingsGoals) {
      map[goal.id] = goal;
    }
    return map;
  }, [savingsGoals]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalSaved = savingsByGoal.reduce((sum, g) => sum + g.currentBalance, 0);

    // Count goals that are on track (early or on-time based on expected vs deadline)
    let onTrackCount = 0;
    let totalWithDeadline = 0;

    for (const goal of savingsByGoal) {
      if (!goal.deadline || goal.targetAmount <= 0) continue;
      if (goal.currentBalance >= goal.targetAmount) {
        onTrackCount++;
        totalWithDeadline++;
        continue;
      }

      totalWithDeadline++;

      // Calculate expected completion
      const totalContributions = goal.monthlySavings.reduce(
        (sum, m) => sum + m.actual + m.forecast,
        0,
      );
      const monthCount = goal.monthlySavings.length || 1;
      const avgMonthlyContribution = totalContributions / monthCount;

      if (avgMonthlyContribution <= 0 && (!goal.annualInterestRate || goal.annualInterestRate <= 0)) {
        continue; // Can't determine if on track
      }

      const monthlyRate = goal.annualInterestRate ? goal.annualInterestRate / 100 / 12 : 0;
      let balance = goal.currentBalance;
      let months = 0;
      const maxMonths = 600;

      while (balance < goal.targetAmount && months < maxMonths) {
        balance += avgMonthlyContribution;
        balance += balance * monthlyRate;
        months++;
      }

      if (months < maxMonths) {
        const now = new Date();
        const expectedDate = new Date(now.getFullYear(), now.getMonth() + months, 1);
        const deadlineDate = new Date(goal.deadline);
        if (expectedDate <= deadlineDate) {
          onTrackCount++;
        }
      }
    }

    // Find next goal to complete (closest expected completion)
    let nextGoal: { name: string; monthsAway: number } | null = null;

    for (const goal of savingsByGoal) {
      if (goal.targetAmount <= 0 || goal.currentBalance >= goal.targetAmount) continue;

      const totalContributions = goal.monthlySavings.reduce(
        (sum, m) => sum + m.actual + m.forecast,
        0,
      );
      const monthCount = goal.monthlySavings.length || 1;
      const avgMonthlyContribution = totalContributions / monthCount;

      if (avgMonthlyContribution <= 0 && (!goal.annualInterestRate || goal.annualInterestRate <= 0)) {
        continue;
      }

      const monthlyRate = goal.annualInterestRate ? goal.annualInterestRate / 100 / 12 : 0;
      let balance = goal.currentBalance;
      let months = 0;
      const maxMonths = 600;

      while (balance < goal.targetAmount && months < maxMonths) {
        balance += avgMonthlyContribution;
        balance += balance * monthlyRate;
        months++;
      }

      if (months < maxMonths && (!nextGoal || months < nextGoal.monthsAway)) {
        nextGoal = { name: goal.goalName, monthsAway: months };
      }
    }

    return {
      totalSaved,
      onTrackCount,
      totalWithDeadline,
      nextGoal,
    };
  }, [savingsByGoal]);

  // Get transaction count per goal for delete warning
  const transactionCountByGoal = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of savingsTransactions) {
      if (t.savingsGoalId) {
        counts[t.savingsGoalId] = (counts[t.savingsGoalId] ?? 0) + 1;
      }
    }
    return counts;
  }, [savingsTransactions]);

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

  const formatMonthsAway = (months: number): string => {
    if (months <= 1) return '1 month';
    if (months < 12) return `${months} months`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return `${years} year${years > 1 ? 's' : ''}`;
    return `${years}y ${remainingMonths}m`;
  };

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
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Total Saved
              </div>
              <div className="mt-1 font-mono text-2xl font-semibold">
                {formatCents(summaryStats.totalSaved)}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                On Track
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {summaryStats.totalWithDeadline > 0 ? (
                  <>
                    {summaryStats.onTrackCount}
                    <span className="text-base font-normal text-muted-foreground">
                      {' '}of {summaryStats.totalWithDeadline}
                    </span>
                  </>
                ) : (
                  <span className="text-base font-normal text-muted-foreground">No deadlines set</span>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Next Goal
              </div>
              <div className="mt-1">
                {summaryStats.nextGoal ? (
                  <>
                    <div className="truncate text-lg font-semibold">{summaryStats.nextGoal.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatMonthsAway(summaryStats.nextGoal.monthsAway)}
                    </div>
                  </>
                ) : (
                  <span className="text-base text-muted-foreground">-</span>
                )}
              </div>
            </div>
          </div>

          {/* Progress Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {savingsByGoal.map((goal) => {
              const savingsGoal = goalMap[goal.goalId];

              return (
                <button
                  key={goal.goalId}
                  type="button"
                  onClick={() => openEditDialog(goal.goalId)}
                  className="w-full cursor-pointer text-left rounded-lg border bg-card transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SavingsGoalProgressCard
                    goalName={goal.goalName}
                    targetAmount={goal.targetAmount}
                    currentBalance={goal.currentBalance}
                    deadline={goal.deadline}
                    annualInterestRate={goal.annualInterestRate}
                    monthlySavings={goal.monthlySavings}
                    isEmergencyFund={savingsGoal?.isEmergencyFund ?? false}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <SavingsGoalDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        goal={editingGoal}
        addSavingsGoal={addSavingsGoal}
        updateSavingsGoal={updateSavingsGoal}
        deleteSavingsGoal={deleteSavingsGoal}
        addTransaction={addTransaction}
        transactionCount={editingGoal ? transactionCountByGoal[editingGoal.id] ?? 0 : 0}
      />
    </div>
  );
}
