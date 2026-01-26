import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
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
import { useRecurringItems } from '@/hooks/use-recurring-items';
import { useCategories } from '@/hooks/use-categories';
import { parseCentsFromInput } from '@/lib/utils';
import type { RecurringFrequency, RecurringType } from '@/lib/types';

export function RecurringNewPage() {
  const navigate = useNavigate();
  const { addRecurringItem } = useRecurringItems();
  const { activeCategories } = useCategories();

  const [type, setType] = useState<RecurringType>('expense');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [dayOfWeek, setDayOfWeek] = useState('1'); // Monday
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!amount || parseCentsFromInput(amount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    const item = addRecurringItem({
      type,
      name: name.trim(),
      amountCents: parseCentsFromInput(amount),
      frequency,
      ...(frequency === 'weekly' || frequency === 'fortnightly'
        ? { dayOfWeek: parseInt(dayOfWeek, 10) }
        : { dayOfMonth: parseInt(dayOfMonth, 10) }),
      categoryId: categoryId || null,
      isActive: true,
    });

    navigate(`/manage/recurring/${item.id}`);
  };

  const showDayOfWeek = frequency === 'weekly' || frequency === 'fortnightly';
  const showDayOfMonth =
    frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly';

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/manage/recurring">
            <ArrowLeft className="h-4 w-4" />
            Back to Recurring
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-bold">New Recurring Item</h1>
      <p className="text-muted-foreground">Set up a recurring income or expense.</p>

      {error && <div className="mt-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <RadioGroup
            value={type}
            onValueChange={(v) => setType(v as RecurringType)}
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
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Rent, Salary, Phone Bill"
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
          <Label htmlFor="frequency">Frequency</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as RecurringFrequency)}>
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

        {showDayOfMonth && (
          <div className="space-y-2">
            <Label htmlFor="dayOfMonth">Day of Month</Label>
            <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    {day}
                    {day === 1 || day === 21 || day === 31
                      ? 'st'
                      : day === 2 || day === 22
                        ? 'nd'
                        : day === 3 || day === 23
                          ? 'rd'
                          : 'th'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="category">Category (optional)</Label>
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

        <div className="flex gap-2 pt-4">
          <Button type="submit">Create Recurring Item</Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/manage/recurring">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
