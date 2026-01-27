import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppConfig } from '@/hooks/use-app-config';
import { useTransactions } from '@/hooks/use-transactions';
import { useScenarios } from '@/hooks/use-scenarios';
import { parseCentsFromInput, today } from '@/lib/utils';

export function FirstRunWizard() {
  const navigate = useNavigate();
  const { markInitialized } = useAppConfig();
  const { addTransaction } = useTransactions();
  const { scenarios, addScenario, setActiveScenarioId } = useScenarios();

  const [balance, setBalance] = useState('');
  const [balanceDate, setBalanceDate] = useState(today());
  const [error, setError] = useState<string | null>(null);

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

    markInitialized();
    navigate('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Welcome to Budget</h1>
          <p className="mt-2 text-muted-foreground">
            Get started by setting your current balance.
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

          <Button type="submit" className="w-full">
            Get Started
          </Button>
        </form>
      </div>
    </div>
  );
}
