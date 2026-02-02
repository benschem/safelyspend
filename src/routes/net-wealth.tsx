import { useMemo, useCallback } from 'react';
import { Link, useOutletContext, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  PiggyBank,
  Banknote,
  CreditCard,
  Sprout,
  ArrowRight,
  Building2,
  Ambulance,
  HandCoins,
} from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
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

export function NetWealthPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { getActiveAnchor } = useBalanceAnchors();
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
  const netWealth = (currentBalance ?? 0) + totalSavings + totalInvestments - totalDebt;

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
              <HandCoins className="h-5 w-5 text-slate-500" />
            </div>
            Net Wealth
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
    <div className="page-shell space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          <div className="page-title-icon bg-slate-500/10">
            <HandCoins className="h-5 w-5 text-slate-500" />
          </div>
          Net Wealth
        </h1>
        <p className="page-description">Your financial position right now</p>
      </div>

      {/* Cash warning banner */}
      {hasNoAnchor && (
        <Alert variant="warning">
          <AlertTitle>No initial cash set</AlertTitle>
          <AlertDescription>
            Add a initial cash amount in{' '}
            <Link to="/settings" className="underline">
              Settings
            </Link>{' '}
            to track your cash over time.
          </AlertDescription>
        </Alert>
      )}

      {/* Net Wealth Hero */}
      <div className="mb-4 min-h-28 text-center sm:min-h-32">
        {/* Spacer row for alignment with other pages */}
        <div className="min-h-8" />
        <p className="flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <HandCoins className="h-4 w-4" />
          Net Wealth
        </p>
        <p className={`mt-2 text-5xl font-bold tracking-tight ${netWealth >= 0 ? '' : 'text-red-500'}`}>
          {netWealth >= 0 ? '' : '-'}{formatCents(Math.abs(netWealth))}
        </p>
        <div className="mx-auto mt-4 mb-3 h-px w-24 bg-border" />
        <p className="text-sm text-muted-foreground">
          Wealthier than {getGlobalPercentile(netWealth)}% of the world
        </p>
      </div>

      {/* Assets & Liabilities */}
      <div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {/* Cash */}
          <Link
            to="/insights?tab=cashflow"
            className="group rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <Banknote className="h-5 w-5 text-green-500" />
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
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500/10">
                <Ambulance className="h-5 w-5 text-slate-500" />
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
    </div>
  );
}
