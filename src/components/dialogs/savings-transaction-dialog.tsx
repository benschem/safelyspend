import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SavingsGoalSelect } from '@/components/savings-goal-select';
import { today, parseCentsFromInput } from '@/lib/utils';
import type { Transaction, CreateEntity } from '@/lib/types';

interface SavingsTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'contribution' | 'withdrawal';
  addTransaction: (data: CreateEntity<Transaction>) => Promise<Transaction>;
}

export function SavingsTransactionDialog({
  open,
  onOpenChange,
  mode,
  addTransaction,
}: SavingsTransactionDialogProps) {
  const todayDate = today();
  const isWithdrawal = mode === 'withdrawal';

  const [date, setDate] = useState(todayDate);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [savingsGoalId, setSavingsGoalId] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDate(todayDate);
      setDescription('');
      setAmount('');
      setSavingsGoalId('');
      setNotes('');
      setFormError(null);
    }
  }, [open, todayDate]);

  const handleSave = async () => {
    setFormError(null);

    if (!description.trim()) {
      setFormError('Please enter a description');
      return;
    }

    let amountCents = parseCentsFromInput(amount);
    if (amountCents <= 0) {
      setFormError('Please enter a valid amount');
      return;
    }

    if (date > todayDate) {
      setFormError('Date cannot be in the future');
      return;
    }

    if (!savingsGoalId) {
      setFormError('Please select a savings goal');
      return;
    }

    if (isWithdrawal) {
      amountCents = -amountCents;
    }

    const data: Parameters<typeof addTransaction>[0] = {
      type: 'savings',
      date,
      description: description.trim(),
      amountCents,
      categoryId: null,
      savingsGoalId,
    };

    if (notes.trim()) {
      data.notes = notes.trim();
    }

    try {
      await addTransaction(data);
      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Failed to save transaction. Please try again.',
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isWithdrawal ? 'Withdraw from Saver' : 'Add Contribution'}
          </DialogTitle>
          <DialogDescription>
            {isWithdrawal
              ? 'Record a withdrawal from a savings goal.'
              : 'Record a deposit into a savings goal.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4"
        >
          {formError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="stx-description" className="select-none">
              Description
            </Label>
            <Input
              id="stx-description"
              placeholder={isWithdrawal ? 'e.g., Emergency expense' : 'e.g., Weekly savings'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stx-date" className="select-none">
                Date
              </Label>
              <Input
                id="stx-date"
                type="date"
                max={todayDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stx-amount" className="select-none">
                Amount ($)
              </Label>
              <Input
                id="stx-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="select-none">Savings Goal</Label>
            <SavingsGoalSelect value={savingsGoalId} onChange={setSavingsGoalId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stx-notes" className="select-none">
              Notes
              <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="stx-notes"
              placeholder="Additional details..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {isWithdrawal ? 'Withdraw' : 'Add Contribution'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
