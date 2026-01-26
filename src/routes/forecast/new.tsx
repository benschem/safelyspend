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
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { today, parseCentsFromInput } from '@/lib/utils';
import type { ForecastType } from '@/lib/types';

interface OutletContext {
  activePeriodId: string | null;
}

export function ForecastNewPage() {
  const navigate = useNavigate();
  const { activePeriodId } = useOutletContext<OutletContext>();
  const { addForecast } = useForecasts(activePeriodId);
  const { activeCategories } = useCategories();
  const { savingsGoals } = useSavingsGoals(activePeriodId);

  const [type, setType] = useState<ForecastType>('expense');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [savingsGoalId, setSavingsGoalId] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!activePeriodId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No period selected</h2>
        <p className="text-muted-foreground">Select a period first.</p>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!date) {
      setError('Date is required');
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

    const forecast = addForecast({
      periodId: activePeriodId,
      type,
      date,
      description: description.trim(),
      amountCents: parseCentsFromInput(amount),
      categoryId: type === 'savings' ? null : categoryId || null,
      savingsGoalId: type === 'savings' ? savingsGoalId : null,
    });

    navigate(`/forecast/${forecast.id}`);
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/forecast">
            <ArrowLeft className="h-4 w-4" />
            Back to Forecasts
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-bold">New Forecast</h1>
      <p className="text-muted-foreground">Add a new projected income or expense.</p>

      {error && <div className="mt-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <RadioGroup
            value={type}
            onValueChange={(v) => setType(v as ForecastType)}
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
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Rent, Salary"
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
            <Label htmlFor="savingsGoal">Savings Goal</Label>
            <Select value={savingsGoalId} onValueChange={setSavingsGoalId}>
              <SelectTrigger>
                <SelectValue placeholder="Select savings goal" />
              </SelectTrigger>
              <SelectContent>
                {savingsGoals.map((goal) => (
                  <SelectItem key={goal.id} value={goal.id}>
                    {goal.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="category">Category {type === 'income' && '(optional)'}</Label>
            <Select
              value={categoryId || '__none__'}
              onValueChange={(v) => setCategoryId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {activeCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button type="submit">Create Forecast</Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/forecast">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
