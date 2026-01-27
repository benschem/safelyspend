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
import { useScenarios } from '@/hooks/use-scenarios';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { parseCentsFromInput } from '@/lib/utils';
import type { ForecastType, Cadence } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

export function RuleNewPage() {
  const navigate = useNavigate();
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { addRule } = useForecasts(activeScenarioId);
  const { activeCategories } = useCategories();
  const { savingsGoals } = useSavingsGoals();

  const [type, setType] = useState<ForecastType>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [dayOfWeek, setDayOfWeek] = useState('0');
  const [categoryId, setCategoryId] = useState('');
  const [savingsGoalId, setSavingsGoalId] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No scenario selected</h2>
        <p className="text-muted-foreground">Select a scenario first.</p>
      </div>
    );
  }

  const showDayOfMonth = cadence === 'monthly' || cadence === 'quarterly' || cadence === 'yearly';
  const showDayOfWeek = cadence === 'weekly' || cadence === 'fortnightly';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

    const rule = addRule({
      scenarioId: activeScenarioId,
      type,
      description: description.trim(),
      amountCents: parseCentsFromInput(amount),
      cadence,
      ...(showDayOfMonth ? { dayOfMonth: parseInt(dayOfMonth, 10) } : {}),
      ...(showDayOfWeek ? { dayOfWeek: parseInt(dayOfWeek, 10) } : {}),
      categoryId: type === 'savings' ? null : categoryId || null,
      savingsGoalId: type === 'savings' ? savingsGoalId : null,
    });

    navigate(`/manage/rules/${rule.id}`);
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/manage/rules">
            <ArrowLeft className="h-4 w-4" />
            Back to Forecast Rules
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-bold">New Forecast Rule</h1>
      <p className="text-muted-foreground">
        Add a recurring income, expense, or savings pattern.
      </p>

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
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Salary, Rent, Car payment"
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

        <div className="space-y-2">
          <Label htmlFor="cadence">Frequency</Label>
          <Select value={cadence} onValueChange={(v) => setCadence(v as Cadence)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="fortnightly">Fortnightly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showDayOfMonth && (
          <div className="space-y-2">
            <Label htmlFor="dayOfMonth">Day of Month</Label>
            <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showDayOfWeek && (
          <div className="space-y-2">
            <Label htmlFor="dayOfWeek">Day of Week</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sunday</SelectItem>
                <SelectItem value="1">Monday</SelectItem>
                <SelectItem value="2">Tuesday</SelectItem>
                <SelectItem value="3">Wednesday</SelectItem>
                <SelectItem value="4">Thursday</SelectItem>
                <SelectItem value="5">Friday</SelectItem>
                <SelectItem value="6">Saturday</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

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
          <Button type="submit">Create Rule</Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/manage/rules">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
