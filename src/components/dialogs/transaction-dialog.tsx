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
import { PaymentMethodSelect } from '@/components/payment-method-select';
import { today, parseCentsFromInput } from '@/lib/utils';
import type { Transaction, TransactionType, CreateEntity } from '@/lib/types';

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  addTransaction: (data: CreateEntity<Transaction>) => Promise<Transaction>;
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
}

export function TransactionDialog({ open, onOpenChange, transaction, addTransaction, updateTransaction }: TransactionDialogProps) {
  const isEditing = !!transaction;
  const todayDate = today();

  // Form state
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(todayDate);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [savingsGoalId, setSavingsGoalId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Reset form when dialog opens/closes or transaction changes
  useEffect(() => {
    if (open) {
      if (transaction) {
        setType(transaction.type);
        setDate(transaction.date);
        setDescription(transaction.description);
        setAmount((transaction.amountCents / 100).toFixed(2));
        setCategoryId(transaction.categoryId ?? '');
        setSavingsGoalId(transaction.savingsGoalId ?? '');
        setPaymentMethod(transaction.paymentMethod ?? '');
        setNotes(transaction.notes ?? '');
      } else {
        setType('expense');
        setDate(todayDate);
        setDescription('');
        setAmount('');
        setCategoryId('');
        setSavingsGoalId('');
        setPaymentMethod('');
        setNotes('');
      }
      setFormError(null);
    }
  }, [open, transaction, todayDate]);

  const handleSave = async () => {
    setFormError(null);

    // Validation
    if (!description.trim()) {
      setFormError('Please enter a description');
      return;
    }

    const amountCents = parseCentsFromInput(amount);
    if (amountCents <= 0) {
      setFormError('Please enter a valid amount');
      return;
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
    if (paymentMethod) {
      data.paymentMethod = paymentMethod;
    }

    if (isEditing && transaction) {
      await updateTransaction(transaction.id, data);
    } else {
      await addTransaction(data);
    }

    onOpenChange(false);
  };

  const isAdjustment = transaction?.type === 'adjustment';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Add'} Transaction</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the transaction details.' : 'Record a new income, expense, or savings transfer.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="tx-description" className="select-none">Description</Label>
            <Input
              id="tx-description"
              placeholder="e.g., Woolworths, Salary"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              <Label htmlFor="tx-date" className="select-none">Date</Label>
              <Input
                id="tx-date"
                type="date"
                max={todayDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tx-amount" className="select-none">Amount ($)</Label>
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
            <div className="space-y-2">
              <Label className="select-none">Savings Goal</Label>
              <SavingsGoalSelect
                value={savingsGoalId}
                onChange={setSavingsGoalId}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="select-none">
                Category
                {type === 'income' && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
              </Label>
              <CategorySelect
                value={categoryId}
                onChange={setCategoryId}
                allowNone
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="select-none">
              Payment Method
              <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
            </Label>
            <PaymentMethodSelect
              value={paymentMethod}
              onChange={setPaymentMethod}
              allowNone
            />
          </div>

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
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {isEditing ? 'Save' : 'Add'} Transaction
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
