import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CategorySelect } from '@/components/category-select';
import { SavingsGoalSelect } from '@/components/savings-goal-select';
import { ArrowLeft } from 'lucide-react';
import { useTransactions } from '@/hooks/use-transactions';
import { today, parseCentsFromInput } from '@/lib/utils';
import type { TransactionType } from '@/lib/types';

export function TransactionNewPage() {
  const navigate = useNavigate();
  const { addTransaction } = useTransactions();

  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [savingsGoalId, setSavingsGoalId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const todayDate = today();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!date) {
      setError('Date is required');
      return;
    }
    if (date > todayDate) {
      setError('Transaction date cannot be in the future');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (!amount || parseCentsFromInput(amount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }
    if (type === 'savings' && !savingsGoalId) {
      setError('Savings goal is required');
      return;
    }

    const transaction = addTransaction({
      type,
      date,
      description: description.trim(),
      amountCents: parseCentsFromInput(amount),
      categoryId: type === 'savings' ? null : categoryId || null,
      savingsGoalId: type === 'savings' ? savingsGoalId : null,
    });

    navigate(`/transactions/${transaction.id}`);
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/transactions">
            <ArrowLeft className="h-4 w-4" />
            Back to Transactions
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-bold">New Transaction</h1>
      <p className="text-muted-foreground">Record an income or expense.</p>

      {error && <div className="mt-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <RadioGroup
            value={type}
            onValueChange={(v) => setType(v as TransactionType)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="expense" id="expense" />
              <Label htmlFor="expense" className="font-normal">
                Expense
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="income" id="income" />
              <Label htmlFor="income" className="font-normal">
                Income
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="savings" id="savings" />
              <Label htmlFor="savings" className="font-normal">
                Savings
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            max={todayDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Woolworths, Salary"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount ($)</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        {type === 'savings' ? (
          <div className="space-y-2">
            <Label>Savings Goal</Label>
            <SavingsGoalSelect value={savingsGoalId} onChange={setSavingsGoalId} />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Category {type === 'income' && '(optional)'}</Label>
            <CategorySelect value={categoryId} onChange={setCategoryId} allowNone />
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button type="submit">Create Transaction</Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/transactions">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
