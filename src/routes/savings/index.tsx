import { useState, useMemo, useCallback, useEffect } from 'react';
import { useOutletContext, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Plus, PiggyBank, TrendingUp, Target, BadgePercent } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useTransactions } from '@/hooks/use-transactions';
import { useReportsData } from '@/hooks/use-reports-data';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { useSavingsAnchors } from '@/hooks/use-savings-anchors';

// Wide date range to capture all savings data
const ALL_DATA_START = '2020-01-01';
const ALL_DATA_END = '2099-12-31';
import { SavingsGoalDialog } from '@/components/dialogs/savings-goal-dialog';
import { TransactionDialog } from '@/components/dialogs/transaction-dialog';
import { SavingsGoalProgressCard } from '@/components/charts';
import { formatCents, today as getToday } from '@/lib/utils';
import type { SavingsGoal } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
}

export function SavingsIndexPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    savingsGoals,
    isLoading: savingsLoading,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
  } = useSavingsGoals();
  const {
    savingsTransactions,
    isLoading: transactionsLoading,
    addTransaction,
    updateTransaction,
  } = useTransactions(ALL_DATA_START, ALL_DATA_END);
  const {
    savingsByGoal,
    savingsContributions,
    isLoading: reportsLoading,
  } = useReportsData(activeScenarioId, ALL_DATA_START, ALL_DATA_END);
  const { anchors } = useBalanceAnchors();
  const { addAnchor: addSavingsAnchor } = useSavingsAnchors();

  // Get the earliest anchor date (for determining if starting balances should be backdated)
  const earliestAnchorDate = useMemo(() => {
    if (anchors.length === 0) return null;
    return anchors.reduce(
      (earliest: string, anchor) => (anchor.date < earliest ? anchor.date : earliest),
      anchors[0]!.date,
    );
  }, [anchors]);

  const isLoading = savingsLoading || transactionsLoading || reportsLoading;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [contributionDialogOpen, setContributionDialogOpen] = useState(false);

  // Handle ?goal= query param to open a specific goal
  const goalParam = searchParams.get('goal');
  useEffect(() => {
    if (goalParam && !isLoading) {
      const goal = savingsGoals.find((g) => g.id === goalParam);
      if (goal) {
        setEditingGoal(goal);
        setDialogOpen(true);
        // Clear the param so refreshing doesn't reopen
        setSearchParams({}, { replace: true });
      }
    }
  }, [goalParam, savingsGoals, isLoading, setSearchParams]);

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
    const totalTarget = savingsByGoal.reduce((sum, g) => sum + g.targetAmount, 0);

    // Count goals reached (all goals with a target where current >= target)
    const goalsWithTarget = savingsByGoal.filter((g) => g.targetAmount > 0);
    const goalsReached = goalsWithTarget.filter((g) => g.currentBalance >= g.targetAmount).length;
    const totalGoals = goalsWithTarget.length;

    // Actual monthly rate: from first contribution to today
    const today = getToday();
    const contributions = savingsTransactions.filter(
      (t) =>
        !t.description.toLowerCase().includes('opening balance') &&
        !t.description.toLowerCase().includes('starting balance'),
    );
    const totalActualSavings = contributions.reduce((sum, t) => sum + t.amountCents, 0);

    // Calculate months from first contribution to today
    let actualMonthlyRate = 0;
    if (contributions.length > 0) {
      const firstDate = contributions.reduce(
        (earliest, t) => (t.date < earliest ? t.date : earliest),
        contributions[0]!.date,
      );
      const [firstYear, firstMonth] = firstDate.split('-').map(Number);
      const [todayYear, todayMonth] = today.split('-').map(Number);
      const actualMonthCount = Math.max(
        1,
        (todayYear! - firstYear!) * 12 + (todayMonth! - firstMonth!) + 1,
      );
      actualMonthlyRate = Math.round(totalActualSavings / actualMonthCount);
    }

    // Planned monthly rate: next 12 months of forecasts
    const totalPlannedSavings = savingsContributions
      .filter((c) => {
        const contributionDate = new Date(c.date);
        const todayDate = new Date(today);
        const monthsDiff =
          (contributionDate.getFullYear() - todayDate.getFullYear()) * 12 +
          (contributionDate.getMonth() - todayDate.getMonth());
        return c.date >= today && monthsDiff < 12;
      })
      .reduce((sum, c) => sum + c.amountCents, 0);
    const plannedMonthlyRate = Math.round(totalPlannedSavings / 12);

    // Annual interest (based on current balances and interest rates)
    const annualInterest = savingsByGoal.reduce((sum, g) => {
      if (!g.annualInterestRate || g.annualInterestRate <= 0) return sum;
      return sum + Math.round(g.currentBalance * (g.annualInterestRate / 100));
    }, 0);

    return {
      totalSaved,
      totalTarget,
      goalsReached,
      totalGoals,
      actualMonthlyRate,
      plannedMonthlyRate,
      annualInterest,
    };
  }, [savingsByGoal, savingsTransactions, savingsContributions, savingsGoals]);

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

  const openEditDialog = useCallback(
    (goalId: string) => {
      const goal = goalMap[goalId];
      if (goal) {
        setEditingGoal(goal);
        setDialogOpen(true);
      }
    },
    [goalMap],
  );

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingGoal(null);
    }
  }, []);

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
          <p className="page-description">Track progress toward your savings goals.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="h-10"
            onClick={() => setContributionDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Contribution
          </Button>
          <Button className="h-10" onClick={openAddDialog}>
            <Plus className="h-4 w-4" />
            Add Goal
          </Button>
        </div>
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Total Saved
              </div>
              <div className="mt-1 font-mono text-2xl font-semibold">
                {formatCents(summaryStats.totalSaved)}
              </div>
              {summaryStats.totalTarget > 0 && (
                <div className="mt-0.5 text-sm text-muted-foreground">
                  of <span className="font-mono">{formatCents(summaryStats.totalTarget)}</span>{' '}
                  target
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                Goals Reached
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {summaryStats.totalGoals > 0 ? (
                  <>
                    {summaryStats.goalsReached}
                    <span className="text-base font-normal text-muted-foreground">
                      {' '}
                      of {summaryStats.totalGoals}
                    </span>
                  </>
                ) : (
                  <span className="text-base font-normal text-muted-foreground">No goals set</span>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PiggyBank className="h-4 w-4" />
                Savings Rate
              </div>
              <div className="mt-1">
                <span className="font-mono text-2xl font-semibold">
                  {formatCents(summaryStats.actualMonthlyRate)}
                </span>
                <span className="ml-1 text-sm text-muted-foreground">/mo avg</span>
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                <span className="font-mono">{formatCents(summaryStats.plannedMonthlyRate)}</span>/mo
                planned (next 12mo)
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BadgePercent className="h-4 w-4" />
                Annual Interest
              </div>
              <div className="mt-1 font-mono text-2xl font-semibold">
                {formatCents(summaryStats.annualInterest)}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">per year</div>
            </div>
          </div>

          <hr className="border-border" />

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
        addSavingsAnchor={addSavingsAnchor}
        transactionCount={editingGoal ? (transactionCountByGoal[editingGoal.id] ?? 0) : 0}
        earliestAnchorDate={earliestAnchorDate}
      />

      <TransactionDialog
        open={contributionDialogOpen}
        onOpenChange={setContributionDialogOpen}
        initialType="savings"
        addTransaction={addTransaction}
        updateTransaction={updateTransaction}
      />
    </div>
  );
}
