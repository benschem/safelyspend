import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft } from 'lucide-react';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { formatCents, formatDate, parseCentsFromInput } from '@/lib/utils';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

export function SavingsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeScenarioId, startDate, endDate } = useOutletContext<OutletContext>();
  const { savingsGoals, updateSavingsGoal, deleteSavingsGoal } = useSavingsGoals();
  const { savingsTransactions } = useTransactions(startDate, endDate);
  const { savingsForecasts } = useForecasts(activeScenarioId, startDate, endDate);

  const goal = savingsGoals.find((g) => g.id === id);

  // Calculate current amount from savings transactions in the date range
  const currentAmountFromTransactions = useMemo(() => {
    if (!goal) return 0;
    return savingsTransactions
      .filter((t) => t.savingsGoalId === goal.id)
      .reduce((sum, t) => sum + t.amountCents, 0);
  }, [savingsTransactions, goal]);

  // Calculate forecasted amount
  const forecastedAmount = useMemo(() => {
    if (!goal) return 0;
    return savingsForecasts
      .filter((f) => f.savingsGoalId === goal.id)
      .reduce((sum, f) => sum + f.amountCents, 0);
  }, [savingsForecasts, goal]);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(goal?.name ?? '');
  const [targetAmount, setTargetAmount] = useState(
    goal ? (goal.targetAmountCents / 100).toFixed(2) : '',
  );
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!goal) {
    return (
      <div>
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/savings">
              <ArrowLeft className="h-4 w-4" />
              Back to Savings
            </Link>
          </Button>
        </div>
        <p className="text-muted-foreground">Savings goal not found.</p>
      </div>
    );
  }

  const progress =
    goal.targetAmountCents === 0
      ? 100
      : Math.min(Math.round((currentAmountFromTransactions / goal.targetAmountCents) * 100), 100);

  const handleSave = () => {
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!targetAmount || parseCentsFromInput(targetAmount) <= 0) {
      setError('Target amount must be greater than 0');
      return;
    }

    updateSavingsGoal(goal.id, {
      name: name.trim(),
      targetAmountCents: parseCentsFromInput(targetAmount),
      ...(deadline ? { deadline } : {}),
    });
    setEditing(false);
  };

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteSavingsGoal(goal.id);
    navigate('/savings');
  };

  const startEditing = () => {
    setName(goal.name);
    setTargetAmount((goal.targetAmountCents / 100).toFixed(2));
    setDeadline(goal.deadline ?? '');
    setEditing(true);
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

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{goal.name}</h1>
          <p className="text-muted-foreground">
            {goal.deadline && `Deadline: ${formatDate(goal.deadline)}`}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-6 rounded-lg border p-4">
        <div className="flex justify-between text-sm">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-4 w-full rounded-full bg-gray-200">
          <div
            className="h-4 rounded-full bg-green-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-sm text-muted-foreground">
          <span>{formatCents(currentAmountFromTransactions)}</span>
          <span>{formatCents(goal.targetAmountCents)}</span>
        </div>
        {forecastedAmount > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            +{formatCents(forecastedAmount)} forecasted
          </p>
        )}
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      <Separator className="my-6" />

      {/* Edit Section */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Goal Details</h2>
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              Edit
            </Button>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave}>Save</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span> {goal.name}
            </p>
            <p>
              <span className="text-muted-foreground">Target:</span>{' '}
              {formatCents(goal.targetAmountCents)}
            </p>
            <p>
              <span className="text-muted-foreground">Saved:</span>{' '}
              {formatCents(currentAmountFromTransactions)}
            </p>
            {forecastedAmount > 0 && (
              <p>
                <span className="text-muted-foreground">Forecasted:</span>{' '}
                +{formatCents(forecastedAmount)}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Deadline:</span>{' '}
              {goal.deadline ? formatDate(goal.deadline) : 'None'}
            </p>
          </div>
        )}
      </section>

      <Separator className="my-6" />

      {/* Danger Zone */}
      <section>
        <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
        <div className="mt-4 rounded-lg border border-destructive/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Delete Goal</h3>
              <p className="text-sm text-muted-foreground">Permanently delete this savings goal.</p>
            </div>
            <div className="flex gap-2">
              {confirmingDelete && (
                <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
              )}
              <Button variant="destructive" onClick={handleDelete}>
                {confirmingDelete ? 'Confirm Delete' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
