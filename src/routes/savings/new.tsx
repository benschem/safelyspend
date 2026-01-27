import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useAccounts } from '@/hooks/use-accounts';
import { useTransactions } from '@/hooks/use-transactions';
import { usePeriods } from '@/hooks/use-periods';
import { parseCentsFromInput } from '@/lib/utils';

interface OutletContext {
  activePeriodId: string | null;
}

export function SavingsNewPage() {
  const navigate = useNavigate();
  const { activePeriodId } = useOutletContext<OutletContext>();
  const { addSavingsGoal } = useSavingsGoals(activePeriodId);
  const { activeAccounts } = useAccounts();
  const { periods } = usePeriods();
  const activePeriod = periods.find((p) => p.id === activePeriodId) ?? null;
  const { addTransaction } = useTransactions(activePeriod);

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [accountId, setAccountId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [scope, setScope] = useState<'period' | 'global'>('period');
  const [error, setError] = useState<string | null>(null);

  if (!activePeriodId || !activePeriod) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No period selected</h2>
        <p className="text-muted-foreground">Select a period first.</p>
      </div>
    );
  }

  const startingBalanceCents = parseCentsFromInput(startingBalance);
  const showAccountSelector = startingBalanceCents > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!targetAmount || parseCentsFromInput(targetAmount) <= 0) {
      setError('Target amount must be greater than 0');
      return;
    }
    if (startingBalanceCents > 0 && !accountId) {
      setError('Select an account for the starting balance');
      return;
    }

    const goal = addSavingsGoal({
      periodId: scope === 'period' ? activePeriodId : null,
      name: name.trim(),
      targetAmountCents: parseCentsFromInput(targetAmount),
      ...(deadline && { deadline }),
    });

    // Create starting balance transaction if amount > 0
    if (startingBalanceCents > 0 && accountId) {
      addTransaction({
        accountId,
        type: 'savings',
        date: activePeriod.startDate,
        amountCents: startingBalanceCents,
        description: 'Starting balance',
        categoryId: null,
        savingsGoalId: goal.id,
      });
    }

    navigate(`/savings/${goal.id}`);
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/savings">
            <ArrowLeft className="h-4 w-4" />
            Back to Savings
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-bold">New Savings Goal</h1>
      <p className="text-muted-foreground">Create a new savings target.</p>

      {error && <div className="mt-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Goal Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Emergency Fund, Holiday"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetAmount">Target Amount ($)</Label>
          <Input
            id="targetAmount"
            type="number"
            step="0.01"
            min="0"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="startingBalance">Starting Balance ($)</Label>
          <Input
            id="startingBalance"
            type="number"
            step="0.01"
            min="0"
            value={startingBalance}
            onChange={(e) => setStartingBalance(e.target.value)}
            placeholder="0.00"
          />
          <p className="text-xs text-muted-foreground">
            Amount already saved toward this goal
          </p>
        </div>

        {showAccountSelector && (
          <div className="space-y-2">
            <Label htmlFor="account">Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Account for the starting balance transaction
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="deadline">Deadline (optional)</Label>
          <Input
            id="deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Scope</Label>
          <RadioGroup
            value={scope}
            onValueChange={(v) => setScope(v as 'period' | 'global')}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="period" id="period" />
              <Label htmlFor="period" className="font-normal">
                This Period
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="global" id="global" />
              <Label htmlFor="global" className="font-normal">
                Global (all periods)
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit">Create Goal</Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/savings">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
