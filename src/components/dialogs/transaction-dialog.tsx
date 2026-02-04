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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategorySelect } from '@/components/category-select';
import { SavingsGoalSelect } from '@/components/savings-goal-select';
import { cn, today, parseCentsFromInput } from '@/lib/utils';
import type { Transaction, TransactionType, CreateEntity } from '@/lib/types';

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  initialType?: TransactionType;
  addTransaction: (data: CreateEntity<Transaction>) => Promise<Transaction>;
  updateTransaction: (
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>,
  ) => Promise<void>;
  onCategoryChanged?: (info: {
    transactionId: string;
    description: string;
    newCategoryId: string;
  }) => void;
}

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  initialType = 'expense',
  addTransaction,
  updateTransaction,
  onCategoryChanged,
}: TransactionDialogProps) {
  const isEditing = !!transaction;
  const todayDate = today();

  // Form state
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(todayDate);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [savingsGoalId, setSavingsGoalId] = useState('');
  const [notes, setNotes] = useState('');
  const [isWithdrawal, setIsWithdrawal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset form when dialog opens/closes or transaction changes
  useEffect(() => {
    if (open) {
      if (transaction) {
        setType(transaction.type);
        setDate(transaction.date);
        setDescription(transaction.description);
        // Handle negative amounts (withdrawals) - show as positive in form
        const isNegative = transaction.amountCents < 0;
        setAmount((Math.abs(transaction.amountCents) / 100).toFixed(2));
        setIsWithdrawal(transaction.type === 'savings' && isNegative);
        setCategoryId(transaction.categoryId ?? '');
        setSavingsGoalId(transaction.savingsGoalId ?? '');
        setNotes(transaction.notes ?? '');
      } else {
        setType(initialType);
        setDate(todayDate);
        setDescription('');
        setAmount('');
        setCategoryId('');
        setSavingsGoalId('');
        setNotes('');
        setIsWithdrawal(false);
      }
      setFormError(null);
    }
  }, [open, transaction, todayDate, initialType]);

  const handleSave = async () => {
    setFormError(null);

    // Validation
    if (!description.trim()) {
      setFormError('Please enter a description');
      return;
    }

    let amountCents = parseCentsFromInput(amount);
    if (amountCents <= 0) {
      setFormError('Please enter a valid amount');
      return;
    }

    // Apply withdrawal as negative amount
    if (type === 'savings' && isWithdrawal) {
      amountCents = -amountCents;
    }

    if (date > todayDate) {
      setFormError('Date cannot be in the future');
      return;
    }

    if (type === 'savings' && !savingsGoalId) {
      setFormError('Please select a savings goal');
      return;
    }

    const data: Parameters<typeof addTransaction>[0] = {
      type,
      date,
      description: description.trim(),
      amountCents,
      categoryId: type === 'savings' ? null : categoryId || null,
      savingsGoalId: type === 'savings' ? savingsGoalId : null,
    };

    if (notes.trim()) {
      data.notes = notes.trim();
    }

    try {
      if (isEditing && transaction) {
        await updateTransaction(transaction.id, data);
        // Notify parent if category changed to a non-null value on a non-savings/adjustment type
        const newCategoryId = data.categoryId;
        if (
          onCategoryChanged &&
          newCategoryId &&
          newCategoryId !== transaction.categoryId &&
          transaction.type !== 'savings' &&
          transaction.type !== 'adjustment'
        ) {
          onCategoryChanged({
            transactionId: transaction.id,
            description: data.description ?? transaction.description,
            newCategoryId,
          });
        }
      } else {
        await addTransaction(data);
      }
      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Failed to save transaction. Please try again.',
      );
    }
  };

  const isAdjustment = transaction?.type === 'adjustment';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Add'} Past Transaction</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the transaction details.'
              : 'Record a past income, expense, or savings transfer.'}
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
            <Label htmlFor="tx-description" className="select-none">
              Description
            </Label>
            <Input
              id="tx-description"
              placeholder="e.g., Woolworths, Salary"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
            />
          </div>

          {!isAdjustment && (
            <div className="space-y-2">
              <Label className="select-none">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as TransactionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tx-date" className="select-none">
                Date
              </Label>
              <Input
                id="tx-date"
                type="date"
                max={todayDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tx-amount" className="select-none">
                Amount ($)
              </Label>
              <Input
                id="tx-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          {type === 'savings' ? (
            <div className="space-y-4">
              {/* Deposit/Withdraw toggle */}
              <div className="space-y-2">
                <Label className="select-none">Action</Label>
                <div className="inline-flex h-9 w-full items-center rounded-lg bg-muted p-1 text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => setIsWithdrawal(false)}
                    className={cn(
                      'inline-flex h-7 flex-1 cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-all',
                      !isWithdrawal
                        ? 'bg-background text-foreground shadow-sm'
                        : 'hover:text-foreground',
                    )}
                  >
                    Deposit
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsWithdrawal(true)}
                    className={cn(
                      'inline-flex h-7 flex-1 cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-all',
                      isWithdrawal
                        ? 'bg-background text-foreground shadow-sm'
                        : 'hover:text-foreground',
                    )}
                  >
                    Withdraw
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="select-none">Savings Goal</Label>
                <SavingsGoalSelect value={savingsGoalId} onChange={setSavingsGoalId} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="select-none">
                Category
                {type === 'income' && (
                  <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
                )}
              </Label>
              <CategorySelect value={categoryId} onChange={setCategoryId} allowNone />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="tx-notes" className="select-none">
              Notes
              <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="tx-notes"
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
            <Button type="submit">{isEditing ? 'Save' : 'Add'} Transaction</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
