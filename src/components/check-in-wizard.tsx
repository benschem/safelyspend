import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  Download,
  PiggyBank,
  Plus,
  Minus,
  SkipForward,
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CsvImportDialog } from '@/components/csv-import-dialog';
import { UpImportDialog } from '@/components/up-import-dialog';
import { useAppConfig } from '@/hooks/use-app-config';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { useSavingsAnchors } from '@/hooks/use-savings-anchors';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useCashSurplus } from '@/hooks/use-cash-surplus';
import { useBudgetPeriodData } from '@/hooks/use-budget-period-data';
import { useScenarios } from '@/hooks/use-scenarios';
import { useTransactions } from '@/hooks/use-transactions';
import { formatCents, today, parseCentsFromInput } from '@/lib/utils';
import { WhatIfProvider } from '@/contexts/what-if-context';
import type { CheckInCadence } from '@/lib/types';

type CheckInStep = 'welcome' | 'import' | 'savings' | 'savings-confirm' | 'balance' | 'summary';

const STEPS: CheckInStep[] = ['welcome', 'import', 'savings', 'savings-confirm', 'balance', 'summary'];

// ─────────────────────────────────────────────────────────────
// Step Progress Dots
// ─────────────────────────────────────────────────────────────

function StepDots({ currentStep, steps }: { currentStep: CheckInStep; steps: CheckInStep[] }) {
  const currentIndex = steps.indexOf(currentStep);
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, i) => (
        <div
          key={step}
          className={`h-2 rounded-full transition-all ${
            i === currentIndex
              ? 'w-6 bg-primary'
              : i < currentIndex
                ? 'w-2 bg-primary/50'
                : 'w-2 bg-muted-foreground/20'
          }`}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Welcome Step
// ─────────────────────────────────────────────────────────────

function WelcomeStep({
  daysSinceLastCheckIn,
  isFirstCheckIn,
  currentBalance,
  hasAnchor,
  cadence,
  onCadenceChange,
  onNext,
}: {
  daysSinceLastCheckIn: number | null;
  isFirstCheckIn: boolean;
  currentBalance: number | null;
  hasAnchor: boolean;
  cadence: CheckInCadence | null;
  onCadenceChange: (c: CheckInCadence) => void;
  onNext: () => void;
}) {
  const [selectedCadence, setSelectedCadence] = useState<CheckInCadence>(cadence ?? 'monthly');

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 rounded-full bg-primary/10 p-4">
        <Calendar className="h-8 w-8 text-primary" />
      </div>

      <h2 className="text-2xl font-bold">Ready to check in?</h2>

      <p className="mt-2 text-muted-foreground">
        {isFirstCheckIn
          ? 'First check-in! Let\u2019s get your finances up to date.'
          : daysSinceLastCheckIn !== null
            ? `It\u2019s been ${daysSinceLastCheckIn} day${daysSinceLastCheckIn !== 1 ? 's' : ''} since your last check-in.`
            : 'Time to update your finances.'}
      </p>

      {hasAnchor && currentBalance !== null && (
        <div className="mt-4 rounded-lg border bg-muted/50 px-6 py-3">
          <p className="text-sm text-muted-foreground">Current cash balance</p>
          <p className="text-2xl font-bold">{formatCents(currentBalance)}</p>
        </div>
      )}

      {isFirstCheckIn && (
        <div className="mt-6 w-full max-w-xs space-y-2">
          <label htmlFor="checkin-cadence" className="text-sm font-medium">How often do you want to check in?</label>
          <Select
            value={selectedCadence}
            onValueChange={(v) => setSelectedCadence(v as CheckInCadence)}
          >
            <SelectTrigger id="checkin-cadence">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="fortnightly">Fortnightly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Button
        className="mt-8"
        size="lg"
        onClick={() => {
          if (isFirstCheckIn) {
            onCadenceChange(selectedCadence);
          }
          onNext();
        }}
      >
        Let&apos;s go
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Import Step
// ─────────────────────────────────────────────────────────────

function ImportStep({
  onNext,
  onSkip,
  onInteract,
}: {
  onNext: () => void;
  onSkip: () => void;
  onInteract: () => void;
}) {
  const [csvOpen, setCsvOpen] = useState(false);
  const [upOpen, setUpOpen] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const { allTransactions } = useTransactions();

  // Track transaction count before import to calculate how many were added
  const [preImportCount, setPreImportCount] = useState<number | null>(null);

  const handleOpenCsv = () => {
    setPreImportCount(allTransactions.length);
    setCsvOpen(true);
  };

  const handleOpenUp = () => {
    setPreImportCount(allTransactions.length);
    setUpOpen(true);
  };

  const handleDialogClose = useCallback(
    (open: boolean, setter: (v: boolean) => void) => {
      setter(open);
      if (!open && preImportCount !== null) {
        const diff = allTransactions.length - preImportCount;
        if (diff > 0) {
          setImportedCount((prev) => prev + diff);
          onInteract();
        }
        setPreImportCount(null);
      }
    },
    [allTransactions.length, preImportCount, onInteract],
  );

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 rounded-full bg-slate-500/10 p-4">
        <Download className="h-8 w-8 text-slate-500" />
      </div>

      <h2 className="text-2xl font-bold">Import your latest transactions</h2>
      <p className="mt-2 text-muted-foreground">
        Bring in recent transactions from your bank so your balances stay accurate.
      </p>

      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={handleOpenCsv}>
          Import CSV
        </Button>
        <Button variant="outline" onClick={handleOpenUp}>
          Import from Up Bank
        </Button>
      </div>

      {importedCount > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950/50 dark:text-green-300">
          <Check className="h-4 w-4" />
          {importedCount} transaction{importedCount !== 1 ? 's' : ''} imported
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        CSV import creates income and expense transactions only. Savings are handled in the next step.
      </p>

      <div className="mt-8 flex gap-3">
        <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
          <SkipForward className="mr-1 h-4 w-4" />
          Skip
        </Button>
        <Button onClick={onNext}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <CsvImportDialog open={csvOpen} onOpenChange={(v) => handleDialogClose(v, setCsvOpen)} />
      <UpImportDialog open={upOpen} onOpenChange={(v) => handleDialogClose(v, setUpOpen)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Savings Transactions Step (contribute / withdraw)
// ─────────────────────────────────────────────────────────────

function SavingsTransactionCard({
  goalId,
  goalName,
  currentBalance,
  onAddTransaction,
}: {
  goalId: string;
  goalName: string;
  currentBalance: number;
  onAddTransaction: (goalId: string, amountCents: number, description: string, date: string) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState<'contribute' | 'withdraw' | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const cents = parseCentsFromInput(amount);
    if (cents <= 0) {
      setError('Please enter an amount greater than $0');
      return;
    }
    const finalCents = showForm === 'withdraw' ? -cents : cents;
    const desc =
      description || (showForm === 'withdraw' ? 'Withdrawal' : 'Contribution');
    try {
      await onAddTransaction(goalId, finalCents, desc, date);
      setAmount('');
      setDate(today());
      setDescription('');
      setShowForm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <PiggyBank className="h-4 w-4 text-blue-500" />
        <h3 className="font-medium">{goalName}</h3>
      </div>
      <p className="mt-1 text-lg font-semibold">{formatCents(currentBalance)}</p>

      {!showForm && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowForm('contribute')}>
            <Plus className="mr-1 h-3 w-3" />
            Contribute
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowForm('withdraw')}>
            <Minus className="mr-1 h-3 w-3" />
            Withdraw
          </Button>
        </div>
      )}

      {showForm && (
        <div className="mt-3 rounded border p-3">
          <p className="text-sm font-medium">
            {showForm === 'contribute' ? 'Add contribution' : 'Record withdrawal'}
          </p>
          <div className="mt-2 space-y-2">
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Amount ($)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="space-y-1">
              <label htmlFor={`savings-tx-date-${goalId}`} className="text-xs text-muted-foreground">Date</label>
              <Input
                id={`savings-tx-date-${goalId}`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <Input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(null); setAmount(''); setDate(today()); setDescription(''); setError(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function useSavingsGoalsWithBalance() {
  const { savingsGoals } = useSavingsGoals();
  const { getActiveAnchor: getSavingsAnchor } = useSavingsAnchors();
  const { allTransactions } = useTransactions();
  const todayStr = today();

  const goalsWithBalance = useMemo(() => {
    const allSavings = allTransactions.filter((t) => t.type === 'savings');
    return savingsGoals.map((goal) => {
      const activeAnchor = getSavingsAnchor(goal.id, todayStr);
      let currentBalance: number;
      if (activeAnchor) {
        const after = allSavings.filter(
          (t) => t.savingsGoalId === goal.id && t.date > activeAnchor.date,
        );
        currentBalance = activeAnchor.balanceCents + after.reduce((sum, t) => sum + t.amountCents, 0);
      } else {
        currentBalance = allSavings
          .filter((t) => t.savingsGoalId === goal.id)
          .reduce((sum, t) => sum + t.amountCents, 0);
      }
      return {
        ...goal,
        currentBalance,
        hasAnchor: activeAnchor !== null,
      };
    });
  }, [savingsGoals, allTransactions, getSavingsAnchor, todayStr]);

  return { savingsGoals, goalsWithBalance };
}

function SavingsStep({
  onNext,
  onSkip,
  onInteract,
}: {
  onNext: () => void;
  onSkip: () => void;
  onInteract: () => void;
}) {
  const { savingsGoals, goalsWithBalance } = useSavingsGoalsWithBalance();
  const { addTransaction } = useTransactions();

  const handleAddTransaction = async (goalId: string, amountCents: number, description: string, date: string) => {
    await addTransaction({
      type: 'savings',
      date,
      amountCents,
      description,
      categoryId: null,
      savingsGoalId: goalId,
    });
    onInteract();
  };

  if (savingsGoals.length === 0) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 rounded-full bg-blue-500/10 p-4">
          <PiggyBank className="h-8 w-8 text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold">No savings goals yet</h2>
        <p className="mt-2 text-muted-foreground">
          You can set up savings goals later from the Savings page.
        </p>
        <div className="mt-6 flex gap-3">
          <Link to="/savings">
            <Button variant="outline">Go to Savings</Button>
          </Link>
          <Button onClick={onNext}>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-6 rounded-full bg-blue-500/10 p-4">
        <PiggyBank className="h-8 w-8 text-blue-500" />
      </div>

      <h2 className="text-2xl font-bold text-center">Savings activity</h2>
      <p className="mt-2 text-center text-muted-foreground">
        Record any contributions or withdrawals since your last check-in.
      </p>

      <div className="mt-6 w-full max-w-md space-y-3">
        {goalsWithBalance.map((goal) => (
          <SavingsTransactionCard
            key={goal.id}
            goalId={goal.id}
            goalName={goal.name}
            currentBalance={goal.currentBalance}
            onAddTransaction={handleAddTransaction}
          />
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
          <SkipForward className="mr-1 h-4 w-4" />
          Skip
        </Button>
        <Button onClick={onNext}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Savings Balance Confirmation Step
// ─────────────────────────────────────────────────────────────

function SavingsConfirmCard({
  goalId,
  goalName,
  currentBalance,
  onSetAnchor,
  onInteract,
}: {
  goalId: string;
  goalName: string;
  currentBalance: number;
  onSetAnchor: (goalId: string, balanceCents: number, date: string) => Promise<void>;
  onInteract: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceDate, setBalanceDate] = useState(today());
  const [error, setError] = useState<string | null>(null);

  const handleSetAnchor = async () => {
    setError(null);
    const cents = parseCentsFromInput(balanceAmount);
    if (isNaN(cents)) {
      setError('Please enter a valid amount');
      return;
    }
    try {
      await onSetAnchor(goalId, cents, balanceDate);
      setShowForm(false);
      setConfirmed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-blue-500" />
          <h3 className="font-medium">{goalName}</h3>
        </div>
        {confirmed && <Check className="h-4 w-4 text-green-500" />}
      </div>
      <p className="mt-1 text-lg font-semibold">{formatCents(currentBalance)}</p>

      {/* Confirm or correct */}
      {!showForm && !confirmed && (
        <div className="mt-3 rounded border bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">
            Does {formatCents(currentBalance)} match your {goalName} saver account?
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setConfirmed(true); onInteract(); }}>
              <Check className="mr-1 h-3 w-3" />
              Yes
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              No, correct it
            </Button>
          </div>
        </div>
      )}

      {/* Correction form */}
      {showForm && !confirmed && (
        <div className="mt-3 rounded border p-3">
          <p className="text-sm font-medium">Correct balance</p>
          <p className="text-xs text-muted-foreground">
            Enter the actual balance from your bank.
          </p>
          <div className="mt-2 space-y-2">
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="space-y-1">
              <label htmlFor={`savings-balance-${goalId}`} className="text-xs text-muted-foreground">Actual balance ($)</label>
              <Input
                id={`savings-balance-${goalId}`}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`savings-date-${goalId}`} className="text-xs text-muted-foreground">As of date</label>
              <Input
                id={`savings-date-${goalId}`}
                type="date"
                value={balanceDate}
                onChange={(e) => setBalanceDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSetAnchor}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SavingsConfirmStep({
  onNext,
  onSkip,
  onInteract,
}: {
  onNext: () => void;
  onSkip: () => void;
  onInteract: () => void;
}) {
  const { goalsWithBalance } = useSavingsGoalsWithBalance();
  const { addAnchor: addSavingsAnchor } = useSavingsAnchors();

  const handleSetAnchor = async (goalId: string, balanceCents: number, date: string) => {
    await addSavingsAnchor({
      savingsGoalId: goalId,
      date,
      balanceCents,
      label: 'Check-in balance',
    });
    onInteract();
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-6 rounded-full bg-blue-500/10 p-4">
        <PiggyBank className="h-8 w-8 text-blue-500" />
      </div>

      <h2 className="text-2xl font-bold text-center">Confirm savings balances</h2>
      <p className="mt-2 text-center text-muted-foreground">
        Check that each balance matches your bank. If not, we&apos;ll correct it.
      </p>

      <div className="mt-6 w-full max-w-md space-y-3">
        {goalsWithBalance.map((goal) => (
          <SavingsConfirmCard
            key={goal.id}
            goalId={goal.id}
            goalName={goal.name}
            currentBalance={goal.currentBalance}
            onSetAnchor={handleSetAnchor}
            onInteract={onInteract}
          />
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
          <SkipForward className="mr-1 h-4 w-4" />
          Skip
        </Button>
        <Button onClick={onNext}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Balance Confirmation Step
// ─────────────────────────────────────────────────────────────

function BalanceStep({
  onNext,
  onSkip,
  onInteract,
}: {
  onNext: () => void;
  onSkip: () => void;
  onInteract: () => void;
}) {
  const { getActiveAnchor, addAnchor } = useBalanceAnchors();
  const { allTransactions } = useTransactions();

  const todayStr = today();
  const activeAnchor = getActiveAnchor(todayStr);

  // Calculate current cash balance (from anchor if available, otherwise net of all cash transactions)
  const currentBalance = useMemo(() => {
    if (activeAnchor) {
      const txsFromAnchor = allTransactions.filter(
        (t) => t.date >= activeAnchor.date && t.date <= todayStr,
      );
      let balance = activeAnchor.balanceCents;
      for (const t of txsFromAnchor) {
        if (t.type === 'income' || t.type === 'adjustment') {
          balance += t.amountCents;
        } else {
          balance -= t.amountCents;
        }
      }
      return balance;
    }
    // No anchor — estimate from all cash transactions
    let balance = 0;
    for (const t of allTransactions) {
      if (t.type === 'income' || t.type === 'adjustment') {
        balance += t.amountCents;
      } else if (t.type === 'expense') {
        balance -= t.amountCents;
      }
      // savings transactions don't affect cash balance estimate
    }
    return balance;
  }, [activeAnchor, allTransactions, todayStr]);

  const [confirmed, setConfirmed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceDate, setBalanceDate] = useState(todayStr);
  const [error, setError] = useState<string | null>(null);

  const handleSetAnchor = async () => {
    setError(null);
    const cents = parseCentsFromInput(balanceAmount);
    if (isNaN(cents)) {
      setError('Please enter a valid amount');
      return;
    }
    try {
      await addAnchor({
        date: balanceDate,
        balanceCents: cents,
        label: 'Check-in balance',
      });
      setShowForm(false);
      setConfirmed(true);
      onInteract();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  const handleConfirm = async () => {
    // If no anchor exists, create one at the current calculated balance
    if (!activeAnchor) {
      try {
        await addAnchor({
          date: todayStr,
          balanceCents: currentBalance,
          label: 'Check-in balance',
        });
      } catch {
        // Non-critical — balance is still confirmed visually
      }
    }
    setConfirmed(true);
    onInteract();
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 rounded-full bg-green-500/10 p-4">
        <Banknote className="h-8 w-8 text-green-500" />
      </div>

      <h2 className="text-2xl font-bold">Cash balance check</h2>

      {!confirmed && !showForm && (
        <>
          <p className="mt-2 text-muted-foreground">
            Does this match your bank account right now?
          </p>
          <div className="mt-4 rounded-lg border bg-muted/50 px-6 py-3">
            <p className="text-3xl font-bold">{formatCents(currentBalance)}</p>
          </div>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={handleConfirm}>
              <Check className="mr-1 h-4 w-4" />
              Yes, that&apos;s right
            </Button>
            <Button variant="outline" onClick={() => setShowForm(true)}>
              No, correct it
            </Button>
          </div>
        </>
      )}

      {showForm && !confirmed && (
        <>
          <p className="mt-2 text-muted-foreground">Enter your actual bank balance.</p>
          <div className="mt-6 w-full max-w-xs space-y-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1 text-left">
              <label htmlFor="cash-balance-update" className="text-sm font-medium">Actual balance ($)</label>
              <Input
                id="cash-balance-update"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1 text-left">
              <label htmlFor="cash-date-update" className="text-sm font-medium">As of date</label>
              <Input
                id="cash-date-update"
                type="date"
                value={balanceDate}
                onChange={(e) => setBalanceDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSetAnchor}>
                Save
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </>
      )}

      {confirmed && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950/50 dark:text-green-300">
          <Check className="h-4 w-4" />
          Balance confirmed
        </div>
      )}

      <div className="mt-8 flex gap-3">
        {!confirmed && (
          <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
            <SkipForward className="mr-1 h-4 w-4" />
            Skip
          </Button>
        )}
        <Button onClick={onNext}>
          {confirmed ? 'Continue' : 'Next'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Summary Step
// ─────────────────────────────────────────────────────────────

function SummaryStep({ onFinish, interacted }: { onFinish: () => void; interacted: boolean }) {
  const navigate = useNavigate();
  const { activeScenario } = useScenarios();
  const scenarioId = activeScenario?.id ?? null;

  // Current month data
  const selectedMonth = useMemo(() => new Date(), []);
  const { periodCashFlow, summary, periodSpending, isLoading } = useBudgetPeriodData({
    scenarioId,
    selectedMonth,
    viewMode: 'month',
  });

  // Cash balance
  const { currentBalance, hasAnchor } = useCashSurplus({
    periodEnd: '',
    isPastPeriod: false,
    remainingIncome: periodCashFlow.income.expected - periodCashFlow.income.actual,
    remainingExpenses: periodCashFlow.expenses.expected - periodCashFlow.expenses.actual,
  });

  // Savings totals
  const { savingsGoals } = useSavingsGoals();
  const { getActiveAnchor: getSavingsAnchor } = useSavingsAnchors();
  const { allTransactions } = useTransactions();
  const todayStr = today();

  const savingsData = useMemo(() => {
    const allSavings = allTransactions.filter((t) => t.type === 'savings');
    let totalSaved = 0;
    const goals = savingsGoals.map((goal) => {
      const activeAnchor = getSavingsAnchor(goal.id, todayStr);
      let balance: number;
      if (activeAnchor) {
        const after = allSavings.filter(
          (t) => t.savingsGoalId === goal.id && t.date > activeAnchor.date,
        );
        balance = activeAnchor.balanceCents + after.reduce((sum, t) => sum + t.amountCents, 0);
      } else {
        balance = allSavings
          .filter((t) => t.savingsGoalId === goal.id)
          .reduce((sum, t) => sum + t.amountCents, 0);
      }
      totalSaved += balance;
      return { name: goal.name, balance, target: goal.targetAmountCents };
    });
    return { totalSaved, goals };
  }, [savingsGoals, allTransactions, getSavingsAnchor, todayStr]);

  // Top 3 spending categories
  const topCategories = useMemo(() => {
    return periodSpending.categorySpending.slice(0, 3);
  }, [periodSpending]);

  // Budget status text
  const budgetStatus = useMemo(() => {
    if (summary.trackedCount === 0) return null;
    if (summary.overCount > 0) {
      return { text: `${summary.overCount} budget${summary.overCount !== 1 ? 's' : ''} over`, color: 'text-red-600 dark:text-red-400' };
    }
    if (summary.overspendingCount > 0) {
      return { text: 'Spending fast in some areas', color: 'text-amber-600 dark:text-amber-400' };
    }
    return { text: 'All budgets on track', color: 'text-green-600 dark:text-green-400' };
  }, [summary]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center text-center">
        <p className="text-muted-foreground">Loading summary...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-6 rounded-full bg-green-500/10 p-4">
        <Check className="h-8 w-8 text-green-500" />
      </div>

      <h2 className="text-2xl font-bold text-center">Check-in complete!</h2>
      <p className="mt-2 text-center text-muted-foreground">
        Here&apos;s your financial snapshot for this month.
      </p>

      <div className="mt-6 w-full max-w-md space-y-3">
        {/* Cash balance */}
        {hasAnchor && currentBalance !== null && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Cash balance</span>
              </div>
              <span className="text-lg font-semibold">{formatCents(currentBalance)}</span>
            </div>
          </div>
        )}

        {/* Total savings */}
        {savingsData.goals.length > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Total savings</span>
              </div>
              <span className="text-lg font-semibold">{formatCents(savingsData.totalSaved)}</span>
            </div>
            {savingsData.goals.length > 0 && (
              <div className="mt-2 space-y-1">
                {savingsData.goals.map((goal) => (
                  <div key={goal.name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{goal.name}</span>
                    <span>
                      {formatCents(goal.balance)}
                      {goal.target > 0 && (
                        <span className="text-muted-foreground">
                          {' '}/ {formatCents(goal.target)}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Projected end of month */}
        {hasAnchor && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-500" />
                <span className="text-sm text-muted-foreground">Projected end of month</span>
              </div>
              <span className="text-lg font-semibold">
                {formatCents((currentBalance ?? 0) + periodCashFlow.net.projected)}
              </span>
            </div>
          </div>
        )}

        {/* Budget status */}
        {budgetStatus && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">Budget status</span>
              </div>
              <span className={`text-sm font-medium ${budgetStatus.color}`}>
                {budgetStatus.text}
              </span>
            </div>
          </div>
        )}

        {/* Top spending */}
        {topCategories.length > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Top spending this month</span>
            </div>
            <div className="space-y-2">
              {topCategories.map((cat) => {
                const percent = cat.budget > 0 ? Math.min(100, (cat.amount / cat.budget) * 100) : 0;
                return (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{cat.name}</span>
                      <span className="font-medium">
                        {formatCents(cat.amount)}
                        {cat.budget > 0 && (
                          <span className="text-muted-foreground"> / {formatCents(cat.budget)}</span>
                        )}
                      </span>
                    </div>
                    {cat.budget > 0 && (
                      <Progress
                        value={percent}
                        className="mt-1 h-1.5"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        <Button
          onClick={() => {
            if (interacted) onFinish();
            navigate('/cash-flow');
          }}
          size="lg"
        >
          Go to Cash Flow
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Wizard
// ─────────────────────────────────────────────────────────────

export function CheckInWizard() {
  const {
    checkInCadence,
    lastCheckInDate,
    daysSinceLastCheckIn,
    setCheckInCadence,
    markCheckInComplete,
  } = useAppConfig();

  const { savingsGoals } = useSavingsGoals();
  const { activeScenario } = useScenarios();
  const { getActiveAnchor } = useBalanceAnchors();
  const { allTransactions } = useTransactions();
  const navigate = useNavigate();

  const todayStr = today();
  const activeAnchor = getActiveAnchor(todayStr);
  const hasAnchor = activeAnchor !== null;

  // Calculate current cash balance for welcome step
  const currentBalance = useMemo(() => {
    if (!activeAnchor) return null;
    const txsFromAnchor = allTransactions.filter(
      (t) => t.date >= activeAnchor.date && t.date <= todayStr,
    );
    let balance = activeAnchor.balanceCents;
    for (const t of txsFromAnchor) {
      if (t.type === 'income' || t.type === 'adjustment') {
        balance += t.amountCents;
      } else {
        balance -= t.amountCents;
      }
    }
    return balance;
  }, [activeAnchor, allTransactions, todayStr]);

  const [interacted, setInteracted] = useState(false);
  const handleInteract = useCallback(() => setInteracted(true), []);

  const isFirstCheckIn = !lastCheckInDate;

  // Determine which steps to include (skip savings if no goals)
  const activeSteps = useMemo(() => {
    if (savingsGoals.length === 0) {
      return STEPS.filter((s) => s !== 'savings' && s !== 'savings-confirm');
    }
    return STEPS;
  }, [savingsGoals.length]);

  // Use search params to track step so browser back/forward works
  const [searchParams, setSearchParams] = useSearchParams();
  const stepParam = searchParams.get('step') as CheckInStep | null;

  // Derive current step from URL, falling back to 'welcome'
  const step: CheckInStep = stepParam && activeSteps.includes(stepParam) ? stepParam : 'welcome';

  // On first render, ensure the welcome step is in the URL (replace, not push)
  useEffect(() => {
    if (!stepParam) {
      setSearchParams({ step: 'welcome' }, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = useCallback(() => {
    const currentIdx = activeSteps.indexOf(step);
    if (currentIdx < activeSteps.length - 1) {
      setSearchParams({ step: activeSteps[currentIdx + 1]! });
    }
  }, [step, activeSteps, setSearchParams]);

  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleFinish = async () => {
    await markCheckInComplete();
  };

  const handleCadenceChange = async (cadence: CheckInCadence) => {
    await setCheckInCadence(cadence);
  };

  const stepIndex = activeSteps.indexOf(step);
  const progressPercent = ((stepIndex + 1) / activeSteps.length) * 100;

  return (
    <WhatIfProvider activeScenarioId={activeScenario?.id ?? null}>
      <div className="flex min-h-screen flex-col bg-background">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            {stepIndex > 0 && step !== 'summary' && (
              <Button variant="ghost" size="sm" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <span className="text-sm font-medium text-muted-foreground">
              Check-in {stepIndex + 1}/{activeSteps.length}
            </span>
          </div>
          {step !== 'summary' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/', { replace: true })}
              className="text-muted-foreground"
            >
              Exit
            </Button>
          )}
        </div>

        {/* Progress bar */}
        <Progress value={progressPercent} className="h-1 rounded-none" />

        {/* Content */}
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-lg">
            {step === 'welcome' && (
              <WelcomeStep
                daysSinceLastCheckIn={daysSinceLastCheckIn}
                isFirstCheckIn={isFirstCheckIn}
                currentBalance={currentBalance}
                hasAnchor={hasAnchor}
                cadence={checkInCadence as CheckInCadence | null}
                onCadenceChange={handleCadenceChange}
                onNext={goNext}
              />
            )}
            {step === 'import' && <ImportStep onNext={goNext} onSkip={goNext} onInteract={handleInteract} />}
            {step === 'savings' && <SavingsStep onNext={goNext} onSkip={goNext} onInteract={handleInteract} />}
            {step === 'savings-confirm' && <SavingsConfirmStep onNext={goNext} onSkip={goNext} onInteract={handleInteract} />}
            {step === 'balance' && <BalanceStep onNext={goNext} onSkip={goNext} onInteract={handleInteract} />}
            {step === 'summary' && <SummaryStep onFinish={handleFinish} interacted={interacted} />}
          </div>
        </div>

        {/* Step dots */}
        <div className="border-t py-4">
          <StepDots currentStep={step} steps={activeSteps} />
        </div>
      </div>
    </WhatIfProvider>
  );
}
