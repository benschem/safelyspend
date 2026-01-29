import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Camera,
  PiggyBank,
  Landmark,
  CreditCard,
  Sprout,
  HandCoins,
  TrendingUp,
  Receipt,
} from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { useTransactions } from '@/hooks/use-transactions';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { ScenarioSelector } from '@/components/scenario-selector';
import { formatCents } from '@/lib/utils';

// Australian net worth percentiles (approximate, ABS data)
// Values in cents
const AU_NET_WORTH_PERCENTILES = [
  { percentile: 0, value: -10000000 },   // -$100k (negative net worth)
  { percentile: 10, value: 5000000 },    // $50k
  { percentile: 20, value: 15000000 },   // $150k
  { percentile: 30, value: 28000000 },   // $280k
  { percentile: 40, value: 43000000 },   // $430k
  { percentile: 50, value: 58000000 },   // $580k (median)
  { percentile: 60, value: 78000000 },   // $780k
  { percentile: 70, value: 105000000 },  // $1.05M
  { percentile: 80, value: 140000000 },  // $1.4M
  { percentile: 90, value: 220000000 },  // $2.2M
  { percentile: 99, value: 500000000 },  // $5M
  { percentile: 100, value: 1000000000 }, // $10M+
];

function getPercentile(value: number, percentiles: typeof AU_NET_WORTH_PERCENTILES): number {
  for (let i = 0; i < percentiles.length - 1; i++) {
    const lower = percentiles[i]!;
    const upper = percentiles[i + 1]!;

    if (value >= lower.value && value < upper.value) {
      const range = upper.value - lower.value;
      const position = value - lower.value;
      const percentileRange = upper.percentile - lower.percentile;
      return Math.round(lower.percentile + (position / range) * percentileRange);
    }
  }

  if (value < percentiles[0]!.value) return 0;
  return 99;
}

interface OutletContext {
  activeScenarioId: string | null;
}

export function SnapshotPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { getActiveAnchor } = useBalanceAnchors();

  // Fixed date ranges - no user selection
  const today = new Date().toISOString().slice(0, 10);

  // Get all transactions for calculations
  const { allTransactions } = useTransactions();

  // Calculate total savings (all time)
  const totalSavings = useMemo(() => {
    return allTransactions
      .filter((t) => t.type === 'savings')
      .reduce((sum, t) => sum + t.amountCents, 0);
  }, [allTransactions]);

  // Get emergency fund and calculate its balance
  const { emergencyFund } = useSavingsGoals();
  const emergencyFundBalance = useMemo(() => {
    if (!emergencyFund) return null;
    return allTransactions
      .filter((t) => t.type === 'savings' && t.savingsGoalId === emergencyFund.id)
      .reduce((sum, t) => sum + t.amountCents, 0);
  }, [emergencyFund, allTransactions]);

  // Get the active anchor for current balance calculation
  const activeAnchor = getActiveAnchor(today);

  // Calculate current balance using anchor-based approach
  const currentBalance = useMemo(() => {
    if (!activeAnchor) return null;

    const transactionsFromAnchor = allTransactions.filter(
      (t) => t.date >= activeAnchor.date && t.date <= today,
    );

    let balance = activeAnchor.balanceCents;
    for (const t of transactionsFromAnchor) {
      if (t.type === 'income' || t.type === 'adjustment') {
        balance += t.amountCents;
      } else {
        balance -= t.amountCents;
      }
    }
    return balance;
  }, [activeAnchor, allTransactions, today]);

  const hasNoAnchor = !activeAnchor;

  // Dummy data for Debt and Investments (to be implemented later)
  const totalDebt = 0;
  const totalInvestments = 0;
  const netWorth = (currentBalance ?? 0) + totalSavings + totalInvestments - totalDebt;

  // Calculate monthly averages from historical data
  const monthlyAverages = useMemo(() => {
    if (allTransactions.length === 0) {
      return { income: 0, expenses: 0, savings: 0 };
    }

    // Find date range of transactions
    const dates = allTransactions.map((t) => t.date).sort();
    const firstDate = new Date(dates[0]!);
    const lastDate = new Date(dates[dates.length - 1]!);

    // Calculate months between first and last transaction (minimum 1 month)
    const monthsDiff = Math.max(
      1,
      (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
        (lastDate.getMonth() - firstDate.getMonth()) + 1
    );

    const totalIncome = allTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amountCents, 0);

    const totalExpenses = allTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amountCents, 0);

    const totalSavingsAmount = allTransactions
      .filter((t) => t.type === 'savings')
      .reduce((sum, t) => sum + t.amountCents, 0);

    return {
      income: Math.round(totalIncome / monthsDiff),
      expenses: Math.round(totalExpenses / monthsDiff),
      savings: Math.round(totalSavingsAmount / monthsDiff),
    };
  }, [allTransactions]);

  if (!activeScenarioId || !activeScenario) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Camera className="h-7 w-7" />
            Snapshot
          </h1>
          <p className="mt-1 text-muted-foreground">Your financial position right now</p>
        </div>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No scenario selected.</p>
          <Button asChild className="mt-4">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Camera className="h-7 w-7" />
            Snapshot
          </h1>
          <p className="mt-1 text-muted-foreground">Your financial position right now</p>
        </div>
        <ScenarioSelector />
      </div>

      <div className="space-y-6">
        {/* Balance warning banner */}
        {hasNoAnchor && (
          <Alert variant="warning">
            <AlertTitle>No balance anchor set</AlertTitle>
            <AlertDescription>
              Set a starting balance in{' '}
              <Link to="/settings" className="underline">
                Settings
              </Link>{' '}
              to enable balance tracking.
            </AlertDescription>
          </Alert>
        )}

        {/* Net Worth - Top Row */}
        <div className="flex justify-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted">
              <HandCoins className="h-7 w-7 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Worth</p>
              <p className={`text-3xl font-bold ${netWorth >= 0 ? '' : 'text-red-500'}`}>
                {netWorth >= 0 ? '' : '-'}{formatCents(Math.abs(netWorth))}
              </p>
              <p className="text-xs text-muted-foreground">
                More than {getPercentile(netWorth, AU_NET_WORTH_PERCENTILES)}% of Australians
              </p>
            </div>
          </div>
        </div>

        {/* Assets Row: Cash, Savings, Debt, Investments */}
        <div className="grid gap-6 grid-cols-2 lg:grid-cols-4 max-w-4xl mx-auto">
          {/* Cash */}
          <Link to="/analyse?tab=cashflow" className="flex items-center gap-4 group">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
              <Landmark className="h-6 w-6 text-sky-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Cash</p>
              {currentBalance !== null ? (
                <p className="text-2xl font-bold">{formatCents(currentBalance)}</p>
              ) : (
                <p className="text-2xl font-bold text-muted-foreground">—</p>
              )}
              <p className="text-xs text-muted-foreground">
                {currentBalance !== null ? 'Bank balance' : 'Not set'}
              </p>
            </div>
          </Link>

          {/* Savings */}
          <Link to="/savings" className="flex items-center gap-4 group">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
              <PiggyBank className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Savings</p>
              <p className="text-2xl font-bold">{formatCents(totalSavings)}</p>
              <p className="text-xs text-muted-foreground">
                {emergencyFund && emergencyFundBalance !== null
                  ? `${formatCents(emergencyFundBalance)} emergency`
                  : 'Across all goals'}
              </p>
            </div>
          </Link>

          {/* Debt - Coming Soon */}
          <div className="flex items-center gap-4 opacity-50">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
              <CreditCard className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Debt</p>
              <p className="text-2xl font-bold text-muted-foreground">—</p>
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </div>
          </div>

          {/* Investments - Coming Soon */}
          <div className="flex items-center gap-4 opacity-50">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
              <Sprout className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Investments</p>
              <p className="text-2xl font-bold text-muted-foreground">—</p>
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </div>
          </div>
        </div>

        {/* Monthly Averages Row */}
        <div className="grid gap-6 grid-cols-3 max-w-3xl mx-auto">
          {/* Average Income */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
              <TrendingUp className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Income</p>
              <p className="text-2xl font-bold">{formatCents(monthlyAverages.income)}</p>
              <p className="text-xs text-muted-foreground">Average per month</p>
            </div>
          </div>

          {/* Average Expenses */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
              <Receipt className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expenses</p>
              <p className="text-2xl font-bold">{formatCents(monthlyAverages.expenses)}</p>
              <p className="text-xs text-muted-foreground">Average per month</p>
            </div>
          </div>

          {/* Average Savings */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
              <PiggyBank className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Savings</p>
              <p className="text-2xl font-bold">{formatCents(monthlyAverages.savings)}</p>
              <p className="text-xs text-muted-foreground">Average per month</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
