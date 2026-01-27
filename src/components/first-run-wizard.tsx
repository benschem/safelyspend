import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppConfig } from '@/hooks/use-app-config';
import { useTransactions } from '@/hooks/use-transactions';
import { useScenarios } from '@/hooks/use-scenarios';
import { parseCentsFromInput, today } from '@/lib/utils';
import { loadDemoDataToStorage } from '@/lib/demo-data';

type WizardStep = 'choose' | 'setup';

export function FirstRunWizard() {
  const navigate = useNavigate();
  const { markInitialized } = useAppConfig();
  const { addTransaction } = useTransactions();
  const { scenarios, addScenario, setActiveScenarioId } = useScenarios();

  const [step, setStep] = useState<WizardStep>('choose');
  const [balance, setBalance] = useState('');
  const [balanceDate, setBalanceDate] = useState(today());
  const [error, setError] = useState<string | null>(null);

  const handleStartDemo = () => {
    loadDemoDataToStorage();
    // Force reload to pick up the new data
    window.location.href = '/dashboard';
  };

  const handleStartFresh = () => {
    setStep('setup');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const balanceCents = parseCentsFromInput(balance);
    if (balanceCents < 0) {
      setError('Balance cannot be negative');
      return;
    }

    if (!balanceDate) {
      setError('Balance date is required');
      return;
    }

    // Create default scenario if none exists
    if (scenarios.length === 0) {
      const scenario = addScenario({
        name: 'Main Budget',
        description: 'My primary budget scenario',
        isDefault: true,
      });
      setActiveScenarioId(scenario.id);
    }

    // Create opening balance adjustment transaction
    if (balanceCents > 0) {
      addTransaction({
        type: 'adjustment',
        date: balanceDate,
        amountCents: balanceCents,
        description: 'Opening balance',
        categoryId: null,
        savingsGoalId: null,
      });
    }

    markInitialized(false);
    navigate('/dashboard');
  };

  if (step === 'choose') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Welcome to Budget</h1>
            <p className="mt-2 text-muted-foreground">
              Track your spending, plan your future, and reach your goals.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleStartFresh}
              className="w-full rounded-lg border-2 border-transparent bg-primary p-6 text-left text-primary-foreground transition-all hover:bg-primary/90"
            >
              <h2 className="text-lg font-semibold">Start fresh</h2>
              <p className="mt-1 text-sm opacity-90">
                Set up your own budget from scratch with your real data.
              </p>
            </button>

            <button
              onClick={handleStartDemo}
              className="w-full rounded-lg border-2 border-border bg-background p-6 text-left transition-all hover:border-primary hover:bg-muted"
            >
              <h2 className="text-lg font-semibold">Explore with demo data</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                See how the app works with 12 months of realistic sample data.
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Set up your budget</h1>
          <p className="mt-2 text-muted-foreground">
            Enter your current spending balance to get started.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="balance">Current Spending Balance ($)</Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              min="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Enter the amount of money you have available to spend right now.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="balanceDate">As of Date</Label>
            <Input
              id="balanceDate"
              type="date"
              value={balanceDate}
              onChange={(e) => setBalanceDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The date this balance was accurate.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('choose')}
              className="flex-1"
            >
              Back
            </Button>
            <Button type="submit" className="flex-1">
              Get Started
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
