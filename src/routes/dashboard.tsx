import { Link, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { usePeriods } from '@/hooks/use-periods';
import { useAccounts } from '@/hooks/use-accounts';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { useOpeningBalances } from '@/hooks/use-opening-balances';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { formatCents } from '@/lib/utils';

interface OutletContext {
  activePeriodId: string | null;
}

export function DashboardPage() {
  const { activePeriodId } = useOutletContext<OutletContext>();
  const { periods } = usePeriods();
  const { activeAccounts } = useAccounts();
  const activePeriod = periods.find((p) => p.id === activePeriodId) ?? null;
  const { transactions, incomeTransactions, expenseTransactions } = useTransactions(activePeriod);
  const { forecasts, incomeForecasts, expenseForecasts } = useForecasts(activePeriodId);
  const { getBalanceForAccount } = useOpeningBalances(activePeriodId);
  const { savingsGoals } = useSavingsGoals(activePeriodId);

  if (!activePeriodId || !activePeriod) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No period selected</h2>
        <p className="text-muted-foreground">Create a period to get started.</p>
        <Button asChild className="mt-4">
          <Link to="/manage/periods/new">Create Period</Link>
        </Button>
      </div>
    );
  }

  // Calculate totals
  const totalOpeningBalance = activeAccounts.reduce(
    (sum, acc) => sum + getBalanceForAccount(acc.id),
    0,
  );

  const actualIncome = incomeTransactions.reduce((sum, t) => sum + t.amountCents, 0);
  const actualExpenses = expenseTransactions.reduce((sum, t) => sum + t.amountCents, 0);
  const actualNet = actualIncome - actualExpenses;

  const forecastedIncome = incomeForecasts.reduce((sum, f) => sum + f.amountCents, 0);
  const forecastedExpenses = expenseForecasts.reduce((sum, f) => sum + f.amountCents, 0);
  const forecastedNet = forecastedIncome - forecastedExpenses;

  const currentBalance = totalOpeningBalance + actualNet;
  const projectedEndBalance = totalOpeningBalance + actualNet + forecastedNet;

  const totalSaved = savingsGoals.reduce((sum, g) => sum + g.currentAmountCents, 0);
  const totalTarget = savingsGoals.reduce((sum, g) => sum + g.targetAmountCents, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Overview for {activePeriod.name}</p>

      {/* Key Metrics */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Opening Balance</p>
          <p className="text-2xl font-bold">{formatCents(totalOpeningBalance)}</p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p
            className={`text-2xl font-bold ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {formatCents(currentBalance)}
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Projected End Balance</p>
          <p
            className={`text-2xl font-bold ${projectedEndBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {formatCents(projectedEndBalance)}
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Available to Spend</p>
          <p
            className={`text-2xl font-bold ${projectedEndBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {formatCents(Math.max(0, projectedEndBalance))}
          </p>
        </div>
      </div>

      {/* Actual vs Forecast */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Actual */}
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Actual (So Far)</h2>
          <p className="text-sm text-muted-foreground">Recorded transactions</p>

          <div className="mt-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Income</span>
              <span className="font-mono text-green-600">+{formatCents(actualIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expenses</span>
              <span className="font-mono text-red-600">-{formatCents(actualExpenses)}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between font-semibold">
                <span>Net</span>
                <span className={actualNet >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {actualNet >= 0 ? '+' : ''}
                  {formatCents(actualNet)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/transactions">{transactions.length} transactions</Link>
            </Button>
          </div>
        </div>

        {/* Forecast */}
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Forecast (Remaining)</h2>
          <p className="text-sm text-muted-foreground">Projected income and expenses</p>

          <div className="mt-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Income</span>
              <span className="font-mono text-green-600">+{formatCents(forecastedIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expenses</span>
              <span className="font-mono text-red-600">-{formatCents(forecastedExpenses)}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between font-semibold">
                <span>Net</span>
                <span className={forecastedNet >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {forecastedNet >= 0 ? '+' : ''}
                  {formatCents(forecastedNet)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/forecast">{forecasts.length} forecasts</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Savings Goals */}
      <div className="mt-8 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Savings Goals</h2>
            <p className="text-sm text-muted-foreground">
              {formatCents(totalSaved)} saved of {formatCents(totalTarget)} target
            </p>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCents(totalSaved)}</p>
        </div>

        {savingsGoals.length === 0 ? (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            No savings goals yet.{' '}
            <Link to="/savings/new" className="text-primary underline">
              Create one
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {savingsGoals.map((goal) => {
              const progress =
                goal.targetAmountCents > 0
                  ? Math.min(100, (goal.currentAmountCents / goal.targetAmountCents) * 100)
                  : 0;
              return (
                <div key={goal.id}>
                  <div className="flex justify-between text-sm">
                    <Link to={`/savings/${goal.id}`} className="font-medium hover:underline">
                      {goal.name}
                      {goal.periodId === null && (
                        <span className="ml-1 text-xs text-muted-foreground">(Global)</span>
                      )}
                    </Link>
                    <span className="text-muted-foreground">
                      {formatCents(goal.currentAmountCents)} / {formatCents(goal.targetAmountCents)}
                    </span>
                  </div>
                  <Progress value={progress} className="mt-1 h-2" />
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/savings">View All Savings</Link>
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/transactions/new">Add Transaction</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/forecast/new">Add Forecast</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/categories">Manage Categories</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/manage/periods/${activePeriodId}`}>Edit Period</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
