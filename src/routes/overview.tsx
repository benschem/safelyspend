import { useMemo, useState, useCallback } from 'react';
import { Link, useOutletContext, useNavigate } from 'react-router';
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
  TrendingDown,
  ArrowRight,
  Building2,
  Ambulance,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageLoading } from '@/components/page-loading';

type AveragePeriod = 'fortnightly' | 'monthly' | 'yearly';
import { useScenarios } from '@/hooks/use-scenarios';
import { useTransactions } from '@/hooks/use-transactions';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { formatCents } from '@/lib/utils';

// Global wealth percentiles (approximate, Credit Suisse Global Wealth Report)
// Values in AUD cents - most people with any savings rank highly globally
const GLOBAL_WEALTH_PERCENTILES = [
  { percentile: 0, value: -10000000 },   // -$100k (negative net worth)
  { percentile: 30, value: 0 },          // $0 - having no debt puts you ahead of 30%
  { percentile: 50, value: 600000 },     // $6k - median global wealth
  { percentile: 60, value: 1500000 },    // $15k
  { percentile: 70, value: 4000000 },    // $40k
  { percentile: 80, value: 7500000 },    // $75k
  { percentile: 88, value: 15000000 },   // $150k
  { percentile: 95, value: 50000000 },   // $500k
  { percentile: 99, value: 150000000 },  // $1.5M
  { percentile: 100, value: 1000000000 }, // $10M+
];

function getGlobalPercentile(value: number): number {
  for (let i = 0; i < GLOBAL_WEALTH_PERCENTILES.length - 1; i++) {
    const lower = GLOBAL_WEALTH_PERCENTILES[i]!;
    const upper = GLOBAL_WEALTH_PERCENTILES[i + 1]!;

    if (value >= lower.value && value < upper.value) {
      const range = upper.value - lower.value;
      const position = value - lower.value;
      const percentileRange = upper.percentile - lower.percentile;
      return Math.round(lower.percentile + (position / range) * percentileRange);
    }
  }

  if (value < GLOBAL_WEALTH_PERCENTILES[0]!.value) return 0;
  return 99;
}

interface OutletContext {
  activeScenarioId: string | null;
}

export function SnapshotPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { getActiveAnchor } = useBalanceAnchors();
  const [averagePeriod, setAveragePeriod] = useState<AveragePeriod>('monthly');
  const navigate = useNavigate();

  // Helper to set up insights navigation with 3-year view
  const goToSavingsInsights = useCallback((viewType: string) => {
    localStorage.setItem('budget:savingsChartView', viewType);
    localStorage.setItem('budget:viewState', JSON.stringify({
      mode: 'around-present',
      amount: 3,
      unit: 'years',
      lastPresetMode: 'around-present',
    }));
    navigate('/insights?tab=savings');
  }, [navigate]);

  // Fixed date ranges - no user selection
  const today = new Date().toISOString().slice(0, 10);

  // Get all transactions for calculations
  const { allTransactions, isLoading: transactionsLoading } = useTransactions();

  // Calculate total savings (all time)
  const totalSavings = useMemo(() => {
    return allTransactions
      .filter((t) => t.type === 'savings')
      .reduce((sum, t) => sum + t.amountCents, 0);
  }, [allTransactions]);

  // Get emergency fund and calculate its balance
  const { emergencyFund, isLoading: savingsLoading } = useSavingsGoals();

  const isLoading = transactionsLoading || savingsLoading;
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

  // Calculate averages from historical data based on selected period
  const periodAverages = useMemo(() => {
    if (allTransactions.length === 0) {
      return { income: 0, expenses: 0, savings: 0, net: 0 };
    }

    // Find date range of transactions
    const dates = allTransactions.map((t) => t.date).sort();
    const firstDate = new Date(dates[0]!);
    const lastDate = new Date(dates[dates.length - 1]!);

    // Calculate days between first and last transaction
    const daysDiff = Math.max(
      1,
      Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );

    // Calculate periods based on selected period type
    let periods: number;
    switch (averagePeriod) {
      case 'fortnightly':
        periods = Math.max(1, daysDiff / 14);
        break;
      case 'monthly':
        periods = Math.max(
          1,
          (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
            (lastDate.getMonth() - firstDate.getMonth()) + 1,
        );
        break;
      case 'yearly':
        periods = Math.max(1, daysDiff / 365);
        break;
    }

    const totalIncome = allTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amountCents, 0);

    const totalExpenses = allTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amountCents, 0);

    const totalSavingsAmount = allTransactions
      .filter((t) => t.type === 'savings')
      .reduce((sum, t) => sum + t.amountCents, 0);

    const income = Math.round(totalIncome / periods);
    const expenses = Math.round(totalExpenses / periods);
    const savings = Math.round(totalSavingsAmount / periods);

    return {
      income,
      expenses,
      savings,
      net: income - expenses - savings,
    };
  }, [allTransactions, averagePeriod]);

  const periodLabels: Record<AveragePeriod, { title: string; net: string }> = {
    fortnightly: { title: 'Fortnightly Average', net: 'Net per fortnight' },
    monthly: { title: 'Monthly Average', net: 'Net per month' },
    yearly: { title: 'Yearly Average', net: 'Net per year' },
  };

  // Show loading spinner while data is being fetched
  if (isLoading) {
    return (
      <div className="page-shell">
        <PageLoading />
      </div>
    );
  }

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <Camera className="h-5 w-5 text-slate-500" />
            </div>
            Snapshot
          </h1>
          <p className="page-description">Your financial position right now</p>
        </div>
        <div className="empty-state">
          <p className="empty-state-text">No scenario selected.</p>
          <Button asChild className="empty-state-action">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          <div className="page-title-icon bg-slate-500/10">
            <Camera className="h-5 w-5 text-slate-500" />
          </div>
          Snapshot
        </h1>
        <p className="page-description">Your financial position right now</p>
      </div>

      {/* Balance warning banner */}
      {hasNoAnchor && (
        <Alert variant="warning" className="mb-8">
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

      {/* Net Wealth Hero */}
      <div className="mb-10 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Net Wealth
        </p>
        <p className={`mt-2 text-5xl font-bold tracking-tight ${netWorth >= 0 ? '' : 'text-red-500'}`}>
          {netWorth >= 0 ? '' : '-'}{formatCents(Math.abs(netWorth))}
        </p>
        <div className="mx-auto mt-4 mb-3 h-px w-24 bg-border" />
        <p className="text-sm text-muted-foreground">
          Wealthier than {getGlobalPercentile(netWorth)}% of the world
        </p>
      </div>

      {/* Assets & Liabilities */}
      <div className="mb-10">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Cash */}
          <Link
            to="/insights?tab=cashflow"
            className="group rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10">
                <Landmark className="h-5 w-5 text-sky-500" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Cash</p>
            {currentBalance !== null ? (
              <p className="mt-1 text-xl font-semibold">{formatCents(currentBalance)}</p>
            ) : (
              <p className="mt-1 text-xl font-semibold text-muted-foreground">—</p>
            )}
            <div className="mt-3 mb-2 h-px bg-border" />
            <p className="text-sm text-muted-foreground">In your everyday account</p>
          </Link>

          {/* Dedicated Savings */}
          <button
            type="button"
            onClick={() => goToSavingsInsights('dedicated')}
            className="group cursor-pointer rounded-xl border bg-card p-5 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                <PiggyBank className="h-5 w-5 text-blue-500" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Dedicated Savings</p>
            <p className="mt-1 text-xl font-semibold">
              {formatCents(totalSavings - (emergencyFundBalance ?? 0))}
            </p>
            <div className="mt-3 mb-2 h-px bg-border" />
            <p className="text-sm text-muted-foreground">For your future goals</p>
          </button>

          {/* Emergency Fund */}
          <button
            type="button"
            onClick={() => goToSavingsInsights(emergencyFund?.id ?? 'total')}
            className="group cursor-pointer rounded-xl border bg-card p-5 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <Ambulance className="h-5 w-5 text-emerald-500" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Emergency Fund</p>
            <p className="mt-1 text-xl font-semibold">
              {formatCents(emergencyFundBalance ?? 0)}
            </p>
            <div className="mt-3 mb-2 h-px bg-border" />
            <p className="text-sm text-muted-foreground">For life&apos;s surprises</p>
          </button>

          {/* Super - Coming Soon */}
          <div className="rounded-xl border bg-card p-5 opacity-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
              <Building2 className="h-5 w-5 text-orange-500" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Super</p>
            <p className="mt-1 text-xl font-semibold text-muted-foreground">$142,850</p>
            <div className="mt-3 mb-2 h-px bg-border" />
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </div>

          {/* Investments - Coming Soon */}
          <div className="rounded-xl border bg-card p-5 opacity-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10">
              <Sprout className="h-5 w-5 text-purple-500" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Investments</p>
            <p className="mt-1 text-xl font-semibold text-muted-foreground">$28,340</p>
            <div className="mt-3 mb-2 h-px bg-border" />
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </div>

          {/* Debt - Coming Soon */}
          <div className="rounded-xl border bg-card p-5 opacity-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
              <CreditCard className="h-5 w-5 text-red-500" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Debt</p>
            <p className="mt-1 text-xl font-semibold text-muted-foreground">$385,200</p>
            <div className="mt-3 mb-2 h-px bg-border" />
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </div>
        </div>
      </div>

      {/* Period Averages */}
      <div className="panel p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {periodLabels[averagePeriod].title}
          </h2>
          <div className="flex rounded-lg bg-muted p-1">
            {(['fortnightly', 'monthly', 'yearly'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setAveragePeriod(period)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  averagePeriod === period
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-6">
          {/* Income */}
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Income</span>
            </div>
            <p className="mt-1 text-2xl font-semibold">{formatCents(periodAverages.income)}</p>
          </div>

          {/* Expenses */}
          <div>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Expenses</span>
            </div>
            <p className="mt-1 text-2xl font-semibold">{formatCents(periodAverages.expenses)}</p>
          </div>

          {/* Savings */}
          <div>
            <div className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Savings</span>
            </div>
            <p className="mt-1 text-2xl font-semibold">{formatCents(periodAverages.savings)}</p>
          </div>
        </div>

        {/* Net per period */}
        <div className="mt-5 flex items-center justify-between border-t pt-5">
          <div className="flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{periodLabels[averagePeriod].net}</span>
          </div>
          <p className={`text-lg font-semibold ${periodAverages.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {periodAverages.net >= 0 ? '+' : ''}{formatCents(periodAverages.net)}
          </p>
        </div>
      </div>
    </div>
  );
}
