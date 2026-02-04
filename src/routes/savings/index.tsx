import { useState, useMemo, useCallback, useEffect } from 'react';
import { useOutletContext, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Plus, Minus, PiggyBank, Goal, BadgePercent } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useTransactions } from '@/hooks/use-transactions';
import { useReportsData } from '@/hooks/use-reports-data';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { useSavingsAnchors } from '@/hooks/use-savings-anchors';

// Wide date range for all-time transaction queries (cheap DB query)
const ALL_DATA_START = '2020-01-01';
const ALL_DATA_END = '2099-12-31';

// Narrow window for reports: 12 months back + 24 months forward (~36 months)
function getReportsRange(): { start: string; end: string } {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 24 + 1, 0); // last day of month 24 months out
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(startDate), end: fmt(endDate) };
}

const REPORTS_RANGE = getReportsRange();

import { SavingsGoalDialog } from '@/components/dialogs/savings-goal-dialog';
import { SavingsTransactionDialog } from '@/components/dialogs/savings-transaction-dialog';
import { SavingsGoalProgressCard } from '@/components/charts';
import { formatCents, formatMonth, today as getToday } from '@/lib/utils';
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
  } = useTransactions(ALL_DATA_START, ALL_DATA_END);
  const {
    savingsByGoal,
    savingsContributions,
    isLoading: reportsLoading,
  } = useReportsData(activeScenarioId, REPORTS_RANGE.start, REPORTS_RANGE.end);
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
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);

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

    // Find the nearest expected completion date across unreached goals
    let nextGoalDate: string | null = null;
    for (const g of savingsByGoal) {
      if (g.targetAmount <= 0 || g.currentBalance >= g.targetAmount) continue;
      const totalContrib = g.monthlySavings.reduce((s, m) => s + m.actual + m.forecast, 0);
      const count = g.monthlySavings.length || 1;
      const avgMonthly = totalContrib / count;
      const monthlyRate = g.annualInterestRate ? g.annualInterestRate / 100 / 12 : 0;
      if (avgMonthly <= 0 && monthlyRate <= 0) continue;
      let bal = g.currentBalance;
      let months = 0;
      while (bal < g.targetAmount && months < 600) {
        bal += avgMonthly;
        bal += bal * monthlyRate;
        months++;
      }
      if (months >= 600) continue;
      const nowDate = new Date(today);
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() + months, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!nextGoalDate || month < nextGoalDate) nextGoalDate = month;
    }

    return {
      totalSaved,
      totalTarget,
      goalsReached,
      totalGoals,
      actualMonthlyRate,
      plannedMonthlyRate,
      annualInterest,
      nextGoalDate,
    };
  }, [savingsByGoal, savingsTransactions, savingsContributions]);

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
            onClick={() => setWithdrawalDialogOpen(true)}
          >
            <Minus className="h-4 w-4" />
            Withdraw
          </Button>
          <Button
            variant="outline"
            className="h-10"
            onClick={() => setContributionDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Contribute
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
          {/* Hero Section */}
          <div className="mb-6 min-h-28 text-center sm:min-h-32">
            <div className="min-h-8" />
            <p className="flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              <PiggyBank className="h-4 w-4" />
              Total Saved
            </p>
            <p className="mt-2 text-5xl font-bold tracking-tight">
              {formatCents(summaryStats.totalSaved)}
            </p>
            {summaryStats.totalTarget > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                of {formatCents(summaryStats.totalTarget)} target
              </p>
            )}
            <div className="mx-auto mt-4 mb-3 h-px w-24 bg-border" />
          </div>

          {/* Stat Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/10">
                  <Goal className="h-3.5 w-3.5 text-teal-500" />
                </div>
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
              {summaryStats.nextGoalDate && (
                <div className="mt-0.5 text-sm text-muted-foreground">
                  Next goal expected {formatMonth(summaryStats.nextGoalDate)}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10">
                  <PiggyBank className="h-3.5 w-3.5 text-blue-500" />
                </div>
                Average Savings per Month
              </div>
              <div className="mt-1 font-mono text-2xl font-semibold">
                {formatCents(Math.abs(summaryStats.actualMonthlyRate))}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                <span className="font-mono">{formatCents(Math.abs(summaryStats.plannedMonthlyRate))}</span>{' '}
                planned
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10">
                  <BadgePercent className="h-3.5 w-3.5 text-amber-500" />
                </div>
                Annual Interest
              </div>
              <div className="mt-1 font-mono text-2xl font-semibold">
                {formatCents(summaryStats.annualInterest)}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">per year</div>
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
        addSavingsAnchor={addSavingsAnchor}
        transactionCount={editingGoal ? (transactionCountByGoal[editingGoal.id] ?? 0) : 0}
        earliestAnchorDate={earliestAnchorDate}
      />

      <SavingsTransactionDialog
        open={contributionDialogOpen}
        onOpenChange={setContributionDialogOpen}
        mode="contribution"
        addTransaction={addTransaction}
      />

      <SavingsTransactionDialog
        open={withdrawalDialogOpen}
        onOpenChange={setWithdrawalDialogOpen}
        mode="withdrawal"
        addTransaction={addTransaction}
      />
    </div>
  );
}
