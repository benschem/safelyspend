import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useTransactions } from '@/hooks/use-transactions';
import { today, parseCentsFromInput } from '@/lib/utils';
import type { SavingsGoal } from '@/lib/types';

interface SavingsGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: SavingsGoal | null;
}

export function SavingsGoalDialog({ open, onOpenChange, goal }: SavingsGoalDialogProps) {
  const { addSavingsGoal, updateSavingsGoal } = useSavingsGoals();
  const { addTransaction } = useTransactions();
  const isEditing = !!goal;

  // Form state
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [deadline, setDeadline] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (goal) {
        setName(goal.name);
        setTargetAmount((goal.targetAmountCents / 100).toFixed(2));
        setStartingBalance('');
        setDeadline(goal.deadline ?? '');
      } else {
        setName('');
        setTargetAmount('');
        setStartingBalance('');
        setDeadline('');
      }
      setFormError(null);
    }
  }, [open, goal]);

  const handleSave = async () => {
    setFormError(null);

    if (!name.trim()) {
      setFormError('Please enter a goal name');
      return;
    }

    const targetAmountCents = parseCentsFromInput(targetAmount);
    if (targetAmountCents <= 0) {
      setFormError('Please enter a valid target amount');
      return;
    }

    if (isEditing && goal) {
      const updates: Parameters<typeof updateSavingsGoal>[1] = {
        name: name.trim(),
        targetAmountCents,
      };
      if (deadline) {
        updates.deadline = deadline;
      }
      await updateSavingsGoal(goal.id, updates);
    } else {
      const newGoal = await addSavingsGoal({
        name: name.trim(),
        targetAmountCents,
        ...(deadline && { deadline }),
      });

      // Create starting balance transaction if amount > 0
      const startingBalanceCents = parseCentsFromInput(startingBalance);
      if (startingBalanceCents > 0) {
        await addTransaction({
          type: 'savings',
          date: today(),
          amountCents: startingBalanceCents,
          description: 'Starting balance',
          categoryId: null,
          savingsGoalId: newGoal.id,
        });
      }
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Add'} Savings Goal</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the savings goal details.' : 'Create a new savings target to track your progress.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="goal-name" className="select-none">Goal Name</Label>
            <Input
              id="goal-name"
              placeholder="e.g., Emergency Fund, Holiday"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="goal-target" className="select-none">Target Amount ($)</Label>
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

            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="goal-starting" className="select-none">
                  Starting Balance
                  <span className="ml-1 font-normal text-muted-foreground">(opt.)</span>
                </Label>
                <Input
                  id="goal-starting"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-deadline" className="select-none">
              Deadline
              <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="goal-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {isEditing ? 'Save' : 'Create'} Goal
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
