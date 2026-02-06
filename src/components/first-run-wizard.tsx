import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  CircleGauge,
  FileSpreadsheet,
  Info,
  PiggyBank,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
const CsvImportDialog = lazy(() =>
  import('@/components/csv-import-dialog').then((m) => ({ default: m.CsvImportDialog })),
);
const UpImportDialog = lazy(() =>
  import('@/components/up-import-dialog').then((m) => ({ default: m.UpImportDialog })),
);
import { TransactionDialog } from '@/components/dialogs/transaction-dialog';
import { useAppConfig } from '@/hooks/use-app-config';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useCategories } from '@/hooks/use-categories';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useSavingsAnchors } from '@/hooks/use-savings-anchors';
import { useScenarios } from '@/hooks/use-scenarios';
import { useTransactions } from '@/hooks/use-transactions';
import { today, formatLongDate, formatCents, parseCentsFromInput } from '@/lib/utils';
import { debug } from '@/lib/debug';

const LandingPage = lazy(() =>
  import('@/components/landing-page').then((m) => ({ default: m.LandingPage })),
);

// ─────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────

type SetupStep = 'welcome' | 'date' | 'cash' | 'savings' | 'budget' | 'transactions' | 'summary';

const STEPS: SetupStep[] = [
  'welcome',
  'date',
  'cash',
  'savings',
  'budget',
  'transactions',
  'summary',
];

interface WizardBudgetEntry {
  tempId: string;
  categoryName: string;
  amount: string; // dollar string, parsed on commit
}

interface WizardSavingsGoal {
  tempId: string;
  name: string;
  targetAmount: string;
  currentBalance: string;
}

// ─────────────────────────────────────────────────────────────
// Step Progress Dots (reused pattern from check-in wizard)
// ─────────────────────────────────────────────────────────────

function StepDots({ currentStep }: { currentStep: SetupStep }) {
  const currentIndex = STEPS.indexOf(currentStep);
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((step, i) => (
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
// Step 1: Welcome
// ─────────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 rounded-full bg-primary/10 p-4">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>

      <h2 className="text-2xl font-bold">Let&apos;s set up your budget</h2>

      <p className="mt-3 max-w-sm text-muted-foreground">
        We&apos;ll pick a starting date, enter your current balances, and you&apos;ll be ready to
        go. It only takes a minute.
      </p>

      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Your data stays on this device. Nothing is sent to a server.
          </p>
        </div>
      </div>

      <Button className="mt-8" size="lg" onClick={onNext}>
        Let&apos;s go
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 2: Starting Date
// ─────────────────────────────────────────────────────────────

function DateStep({
  startingDate,
  onDateChange,
  onNext,
}: {
  startingDate: string;
  onDateChange: (date: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 rounded-full bg-violet-500/10 p-4">
        <CalendarDays className="h-8 w-8 text-violet-500" />
      </div>

      <h2 className="text-2xl font-bold">When do you want to start tracking?</h2>
      <p className="mt-2 text-muted-foreground">
        All your balances should be as of this date. You&apos;ll import or enter transactions from
        this date onwards.
      </p>

      <div className="mt-6 w-full max-w-xs">
        <Input
          type="date"
          value={startingDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="text-center text-lg"
        />
      </div>

      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            If you don&apos;t want to backfill old transactions, just use today&apos;s date and
            start fresh.
          </p>
        </div>
      </div>

      <Button className="mt-8" size="lg" onClick={onNext} disabled={!startingDate}>
        Continue
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 3: Cash Balance
// ─────────────────────────────────────────────────────────────

function CashBalanceStep({
  startingDate,
  cashBalance,
  onCashBalanceChange,
  onNext,
}: {
  startingDate: string;
  cashBalance: string;
  onCashBalanceChange: (value: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 rounded-full bg-green-500/10 p-4">
        <Banknote className="h-8 w-8 text-green-500" />
      </div>

      <h2 className="text-2xl font-bold">How much cash was in your bank account?</h2>
      <p className="mt-2 text-muted-foreground">As of {formatLongDate(startingDate)}</p>

      <div className="mt-6 w-full max-w-xs">
        <div className="space-y-1 text-left">
          <label htmlFor="cash-balance" className="text-sm font-medium">
            Cash balance ($)
          </label>
          <Input
            id="cash-balance"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={cashBalance}
            onChange={(e) => onCashBalanceChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Enter $0 if you&apos;re starting from scratch.
          </p>
        </div>
      </div>

      <Button className="mt-8" size="lg" onClick={onNext}>
        Continue
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 4: Savings Goals
// ─────────────────────────────────────────────────────────────

function SavingsGoalCard({
  goal,
  startingDate,
  onRemove,
}: {
  goal: WizardSavingsGoal;
  startingDate: string;
  onRemove: () => void;
}) {
  const balanceCents = parseCentsFromInput(goal.currentBalance);
  const targetCents = parseCentsFromInput(goal.targetAmount);
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-blue-500" />
          <h3 className="font-medium">{goal.name}</h3>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-1 flex items-baseline gap-2 text-sm text-muted-foreground">
        <span>Target: {formatCents(targetCents)}</span>
        {balanceCents > 0 && (
          <>
            <span>&middot;</span>
            <span>
              Balance as of {formatLongDate(startingDate)}: {formatCents(balanceCents)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function SavingsGoalsStep({
  startingDate,
  savingsGoals,
  onAddGoal,
  onRemoveGoal,
  onNext,
}: {
  startingDate: string;
  savingsGoals: WizardSavingsGoal[];
  onAddGoal: (goal: WizardSavingsGoal) => void;
  onRemoveGoal: (tempId: string) => void;
  onNext: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setTargetAmount('');
    setCurrentBalance('');
    setError(null);
  };

  const handleAdd = () => {
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    const targetCents = parseCentsFromInput(targetAmount);
    if (targetCents <= 0) {
      setError('Target amount must be greater than $0');
      return;
    }

    onAddGoal({
      tempId: crypto.randomUUID(),
      name: name.trim(),
      targetAmount,
      currentBalance,
    });
    resetForm();
    setShowForm(false);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-6 rounded-full bg-blue-500/10 p-4">
        <PiggyBank className="h-8 w-8 text-blue-500" />
      </div>

      <h2 className="text-2xl font-bold text-center">Do you have any savings?</h2>
      <p className="mt-2 text-center text-muted-foreground">
        Enter the balance of each saver account as of {formatLongDate(startingDate)}
      </p>

      {savingsGoals.length > 0 && (
        <div className="mt-6 w-full max-w-md space-y-3">
          {savingsGoals.map((goal) => (
            <SavingsGoalCard
              key={goal.tempId}
              goal={goal}
              startingDate={startingDate}
              onRemove={() => onRemoveGoal(goal.tempId)}
            />
          ))}
        </div>
      )}

      {!showForm && (
        <Button variant="outline" className="mt-6" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add a savings goal
        </Button>
      )}

      {showForm && (
        <div className="mt-6 w-full max-w-md rounded-lg border p-4">
          <p className="text-sm font-medium">New savings goal</p>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <div className="mt-3 space-y-3">
            <div className="space-y-1 text-left">
              <label htmlFor="goal-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="goal-name"
                placeholder="e.g. Holiday fund"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1 text-left">
              <label htmlFor="goal-target" className="text-sm font-medium">
                Target amount ($)
              </label>
              <Input
                id="goal-target"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1 text-left">
              <label htmlFor="goal-balance" className="text-sm font-medium">
                Current balance ($)
              </label>
              <Input
                id="goal-balance"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={currentBalance}
                onChange={(e) => setCurrentBalance(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                How much is already in this saver? Leave blank or $0 if nothing saved yet.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-3">
        {savingsGoals.length === 0 && (
          <Button variant="ghost" onClick={onNext} className="text-muted-foreground">
            Skip
          </Button>
        )}
        <Button onClick={onNext}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 5: Budget
// ─────────────────────────────────────────────────────────────

function BudgetEntryCard({ entry, onRemove }: { entry: WizardBudgetEntry; onRemove: () => void }) {
  const amountCents = parseCentsFromInput(entry.amount);
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CircleGauge className="h-4 w-4 text-amber-500" />
          <h3 className="font-medium">{entry.categoryName}</h3>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{formatCents(amountCents)} / month</div>
    </div>
  );
}

function BudgetStep({
  budgetEntries,
  onAddEntry,
  onRemoveEntry,
  onNext,
}: {
  budgetEntries: WizardBudgetEntry[];
  onAddEntry: (entry: WizardBudgetEntry) => void;
  onRemoveEntry: (tempId: string) => void;
  onNext: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setCategoryName('');
    setAmount('');
    setError(null);
  };

  const handleAdd = () => {
    setError(null);
    if (!categoryName.trim()) {
      setError('Category name is required');
      return;
    }
    const amountCents = parseCentsFromInput(amount);
    if (amountCents <= 0) {
      setError('Monthly budget must be greater than $0');
      return;
    }

    onAddEntry({
      tempId: crypto.randomUUID(),
      categoryName: categoryName.trim(),
      amount,
    });
    resetForm();
    setShowForm(false);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-6 rounded-full bg-amber-500/10 p-4">
        <CircleGauge className="h-8 w-8 text-amber-500" />
      </div>

      <h2 className="text-2xl font-bold text-center">Set up your spending budget</h2>
      <p className="mt-2 text-center text-muted-foreground">
        Add categories and set a monthly spending limit for each.
      </p>

      {budgetEntries.length > 0 && (
        <div className="mt-6 w-full max-w-md space-y-3">
          {budgetEntries.map((entry) => (
            <BudgetEntryCard
              key={entry.tempId}
              entry={entry}
              onRemove={() => onRemoveEntry(entry.tempId)}
            />
          ))}
        </div>
      )}

      {!showForm && (
        <Button variant="outline" className="mt-6" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add a category
        </Button>
      )}

      {showForm && (
        <div className="mt-6 w-full max-w-md rounded-lg border p-4">
          <p className="text-sm font-medium">New budget category</p>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <div className="mt-3 space-y-3">
            <div className="space-y-1 text-left">
              <label htmlFor="budget-category-name" className="text-sm font-medium">
                Category name
              </label>
              <Input
                id="budget-category-name"
                placeholder="e.g. Groceries"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
              />
            </div>
            <div className="space-y-1 text-left">
              <label htmlFor="budget-amount" className="text-sm font-medium">
                Monthly budget ($)
              </label>
              <Input
                id="budget-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-3">
        {budgetEntries.length === 0 && (
          <Button variant="ghost" onClick={onNext} className="text-muted-foreground">
            Skip
          </Button>
        )}
        <Button onClick={onNext}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 6: Transactions
// ─────────────────────────────────────────────────────────────

function TransactionsStep({
  startingDate,
  transactionCount,
  onOpenCsvImport,
  onOpenUpImport,
  onOpenManualAdd,
  onNext,
}: {
  startingDate: string;
  transactionCount: number;
  onOpenCsvImport: () => void;
  onOpenUpImport: () => void;
  onOpenManualAdd: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-6 rounded-full bg-indigo-500/10 p-4">
        <ArrowLeftRight className="h-8 w-8 text-indigo-500" />
      </div>

      <h2 className="text-2xl font-bold text-center">Add your transactions</h2>
      <p className="mt-2 text-center text-muted-foreground">
        Import or enter transactions from {formatLongDate(startingDate)} onwards.
      </p>

      <div className="mt-6 w-full max-w-md space-y-3">
        <button
          type="button"
          onClick={onOpenCsvImport}
          className="w-full cursor-pointer text-left rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Import from CSV</p>
              <p className="text-sm text-muted-foreground">
                Upload a CSV file exported from your bank
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenUpImport}
          className="w-full cursor-pointer text-left rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Import from Up Bank</p>
              <p className="text-sm text-muted-foreground">
                Upload an Up Bank transaction export
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenManualAdd}
          className="w-full cursor-pointer text-left rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-3">
            <Plus className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Add manually</p>
              <p className="text-sm text-muted-foreground">Enter a transaction by hand</p>
            </div>
          </div>
        </button>
      </div>

      {transactionCount > 0 && (
        <div className="mt-6 text-center">
          <p className="text-3xl font-bold">{transactionCount}</p>
          <p className="text-sm text-muted-foreground">
            {transactionCount === 1 ? 'transaction' : 'transactions'} added
          </p>
        </div>
      )}

      <div className="mt-8 flex gap-3">
        {transactionCount === 0 && (
          <Button variant="ghost" onClick={onNext} className="text-muted-foreground">
            Skip
          </Button>
        )}
        <Button onClick={onNext}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 7: Summary
// ─────────────────────────────────────────────────────────────

function SetupSummaryStep({
  startingDate,
  cashBalanceCents,
  savingsGoals,
  budgetEntries,
  transactionCount,
  onFinish,
  isSubmitting,
  submitError,
}: {
  startingDate: string;
  cashBalanceCents: number;
  savingsGoals: WizardSavingsGoal[];
  budgetEntries: WizardBudgetEntry[];
  transactionCount: number;
  onFinish: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-6 rounded-full bg-green-500/10 p-4">
        <Check className="h-8 w-8 text-green-500" />
      </div>

      <h2 className="text-2xl font-bold text-center">You&apos;re all set!</h2>
      <p className="mt-2 text-center text-muted-foreground">
        Here&apos;s a summary of what we&apos;ll create.
      </p>

      <div className="mt-6 w-full max-w-md space-y-3">
        {/* Starting date */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-violet-500" />
              <span className="text-sm text-muted-foreground">Starting date</span>
            </div>
            <span className="font-medium">{formatLongDate(startingDate)}</span>
          </div>
        </div>

        {/* Cash balance */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Cash balance</span>
            </div>
            <span className="text-lg font-semibold">{formatCents(cashBalanceCents)}</span>
          </div>
        </div>

        {/* Savings goals */}
        {savingsGoals.length > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <PiggyBank className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Savings goals</span>
            </div>
            <div className="space-y-2">
              {savingsGoals.map((goal) => {
                const balanceCents = parseCentsFromInput(goal.currentBalance);
                const targetCents = parseCentsFromInput(goal.targetAmount);
                return (
                  <div key={goal.tempId} className="flex items-center justify-between text-sm">
                    <span>{goal.name}</span>
                    <span>
                      {formatCents(balanceCents)}
                      {targetCents > 0 && (
                        <span className="text-muted-foreground"> / {formatCents(targetCents)}</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Budget categories */}
        {budgetEntries.length > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <CircleGauge className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Monthly budget</span>
            </div>
            <div className="space-y-2">
              {budgetEntries.map((entry) => {
                const amountCents = parseCentsFromInput(entry.amount);
                return (
                  <div key={entry.tempId} className="flex items-center justify-between text-sm">
                    <span>{entry.categoryName}</span>
                    <span>{formatCents(amountCents)}</span>
                  </div>
                );
              })}
              <div className="border-t pt-2 flex items-center justify-between text-sm font-medium">
                <span>Total</span>
                <span>
                  {formatCents(
                    budgetEntries.reduce(
                      (sum, entry) => sum + parseCentsFromInput(entry.amount),
                      0,
                    ),
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Transactions imported */}
        {transactionCount > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-indigo-500" />
                <span className="text-sm text-muted-foreground">Transactions imported</span>
              </div>
              <span className="font-medium">{transactionCount}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {transactionCount > 0
              ? 'You can import more transactions later from the Transactions page.'
              : 'You can import transactions later from the Transactions page.'}
          </p>
        </div>
      </div>

      {submitError && <p className="mt-4 text-sm text-destructive">{submitError}</p>}

      <Button className="mt-8" size="lg" onClick={onFinish} disabled={isSubmitting}>
        {isSubmitting ? 'Setting up...' : 'Get started'}
        {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Setup Wizard (inner component)
// ─────────────────────────────────────────────────────────────

function SetupWizard() {
  const navigate = useNavigate();
  const { markInitialized } = useAppConfig();
  const { addAnchor } = useBalanceAnchors();
  const { addBudgetRule } = useBudgetRules(null);
  const { getOrCreate } = useCategories();
  const { addSavingsGoal } = useSavingsGoals();
  const { addAnchor: addSavingsAnchor } = useSavingsAnchors();
  const { addScenario, setActiveScenarioId } = useScenarios();
  const { addTransaction, updateTransaction, allTransactions } = useTransactions();

  // Dialog open states
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [upImportOpen, setUpImportOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);

  // Wizard state
  const [startingDate, setStartingDate] = useState(today());
  const [cashBalance, setCashBalance] = useState('');
  const [savingsGoals, setSavingsGoals] = useState<WizardSavingsGoal[]>([]);
  const [budgetEntries, setBudgetEntries] = useState<WizardBudgetEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // URL-based step tracking
  const [searchParams, setSearchParams] = useSearchParams();
  const stepParam = searchParams.get('step') as SetupStep | null;
  const step: SetupStep = stepParam && STEPS.includes(stepParam) ? stepParam : 'welcome';

  // Ensure the welcome step is in the URL on first render
  useEffect(() => {
    if (!stepParam || !STEPS.includes(stepParam as SetupStep)) {
      setSearchParams({ setup: '1', step: 'welcome' }, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = useCallback(() => {
    const currentIdx = STEPS.indexOf(step);
    if (currentIdx < STEPS.length - 1) {
      setSearchParams({ setup: '1', step: STEPS[currentIdx + 1]! });
    }
  }, [step, setSearchParams]);

  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleExit = useCallback(() => {
    navigate('/landing', { replace: true });
  }, [navigate]);

  const handleAddGoal = useCallback((goal: WizardSavingsGoal) => {
    setSavingsGoals((prev) => [...prev, goal]);
  }, []);

  const handleRemoveGoal = useCallback((tempId: string) => {
    setSavingsGoals((prev) => prev.filter((g) => g.tempId !== tempId));
  }, []);

  const handleAddBudgetEntry = useCallback((entry: WizardBudgetEntry) => {
    setBudgetEntries((prev) => [...prev, entry]);
  }, []);

  const handleRemoveBudgetEntry = useCallback((tempId: string) => {
    setBudgetEntries((prev) => prev.filter((e) => e.tempId !== tempId));
  }, []);

  const handleFinish = async () => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      // 1. Create default scenario
      const scenario = await addScenario({
        name: 'Current Plan',
        isDefault: true,
      });
      await setActiveScenarioId(scenario.id);

      // 2. Create balance anchor (even if $0, to set the anchor date)
      const cashCents = parseCentsFromInput(cashBalance);
      await addAnchor({
        date: startingDate,
        balanceCents: cashCents,
        label: 'Starting balance',
      });

      // 3. Create savings goals + anchors
      for (const goal of savingsGoals) {
        const targetCents = parseCentsFromInput(goal.targetAmount);
        const balanceCents = parseCentsFromInput(goal.currentBalance);

        const newGoal = await addSavingsGoal({
          name: goal.name,
          targetAmountCents: targetCents,
        });

        if (balanceCents > 0) {
          await addSavingsAnchor({
            savingsGoalId: newGoal.id,
            date: startingDate,
            balanceCents,
            label: 'Starting balance',
          });
        }
      }

      // 4. Create categories + budget rules (getOrCreate deduplicates with CSV-imported categories)
      for (const entry of budgetEntries) {
        const categoryId = await getOrCreate(entry.categoryName);
        if (!categoryId) continue;
        const amountCents = parseCentsFromInput(entry.amount);
        if (amountCents > 0) {
          await addBudgetRule({
            scenarioId: scenario.id,
            categoryId,
            amountCents,
            cadence: 'monthly',
            dayOfMonth: 1,
          });
        }
      }

      // 5. Mark initialized
      await markInitialized(false);

      // 6. Navigate to cash flow
      navigate('/cash-flow', { replace: true });
    } catch (error) {
      debug.error('db', 'Setup failed', error);
      setSubmitError('Setup failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  const stepIndex = STEPS.indexOf(step);
  const progressPercent = ((stepIndex + 1) / STEPS.length) * 100;

  return (
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
            Setup {stepIndex + 1}/{STEPS.length}
          </span>
        </div>
        {step !== 'summary' && (
          <Button variant="ghost" size="sm" onClick={handleExit} className="text-muted-foreground">
            Exit
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <Progress value={progressPercent} className="h-1 rounded-none" />

      {/* Content */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {step === 'welcome' && <WelcomeStep onNext={goNext} />}
          {step === 'date' && (
            <DateStep startingDate={startingDate} onDateChange={setStartingDate} onNext={goNext} />
          )}
          {step === 'cash' && (
            <CashBalanceStep
              startingDate={startingDate}
              cashBalance={cashBalance}
              onCashBalanceChange={setCashBalance}
              onNext={goNext}
            />
          )}
          {step === 'savings' && (
            <SavingsGoalsStep
              startingDate={startingDate}
              savingsGoals={savingsGoals}
              onAddGoal={handleAddGoal}
              onRemoveGoal={handleRemoveGoal}
              onNext={goNext}
            />
          )}
          {step === 'budget' && (
            <BudgetStep
              budgetEntries={budgetEntries}
              onAddEntry={handleAddBudgetEntry}
              onRemoveEntry={handleRemoveBudgetEntry}
              onNext={goNext}
            />
          )}
          {step === 'transactions' && (
            <TransactionsStep
              startingDate={startingDate}
              transactionCount={allTransactions.length}
              onOpenCsvImport={() => setCsvImportOpen(true)}
              onOpenUpImport={() => setUpImportOpen(true)}
              onOpenManualAdd={() => setTransactionDialogOpen(true)}
              onNext={goNext}
            />
          )}
          {step === 'summary' && (
            <SetupSummaryStep
              startingDate={startingDate}
              cashBalanceCents={parseCentsFromInput(cashBalance)}
              savingsGoals={savingsGoals}
              budgetEntries={budgetEntries}
              transactionCount={allTransactions.length}
              onFinish={handleFinish}
              isSubmitting={isSubmitting}
              submitError={submitError}
            />
          )}
        </div>
      </div>

      {/* Import/entry dialogs (rendered as portals) */}
      <Suspense fallback={null}>
        <CsvImportDialog open={csvImportOpen} onOpenChange={setCsvImportOpen} />
        <UpImportDialog open={upImportOpen} onOpenChange={setUpImportOpen} />
      </Suspense>
      <TransactionDialog
        open={transactionDialogOpen}
        onOpenChange={setTransactionDialogOpen}
        addTransaction={addTransaction}
        updateTransaction={updateTransaction}
        existingTransactions={allTransactions}
      />

      {/* Step dots */}
      <div className="border-t py-4">
        <StepDots currentStep={step} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Export: Landing Page vs Setup Wizard
// ─────────────────────────────────────────────────────────────

export function FirstRunWizard() {
  const [searchParams] = useSearchParams();
  const isSetup = searchParams.get('setup') === '1';

  const handleStartDemo = async () => {
    const { loadDemoDataToStorage } = await import('@/lib/demo-data');
    await loadDemoDataToStorage();
    window.location.href = '/';
  };

  if (isSetup) {
    return <SetupWizard />;
  }

  return (
    <Suspense fallback={null}>
      <LandingPage onViewDemo={handleStartDemo} />
    </Suspense>
  );
}
