import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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
import { formatCents, parseCentsFromInput } from '@/lib/utils';
import type { RecurringFrequency, RecurringType } from '@/lib/types';

const frequencyLabels: Record<string, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const dayOfWeekLabels = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function RecurringDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { recurringItems, updateRecurringItem, deleteRecurringItem } = useRecurringItems();
  const { categories, activeCategories } = useCategories();

  const item = recurringItems.find((i) => i.id === id);

  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<RecurringType>(item?.type ?? 'expense');
  const [name, setName] = useState(item?.name ?? '');
  const [amount, setAmount] = useState(item ? (item.amountCents / 100).toFixed(2) : '');
  const [frequency, setFrequency] = useState<RecurringFrequency>(item?.frequency ?? 'monthly');
  const [dayOfMonth, setDayOfMonth] = useState((item?.dayOfMonth ?? 1).toString());
  const [dayOfWeek, setDayOfWeek] = useState((item?.dayOfWeek ?? 1).toString());
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!item) {
    return (
      <div>
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/manage/recurring">
              <ArrowLeft className="h-4 w-4" />
              Back to Recurring
            </Link>
          </Button>
        </div>
        <p className="text-muted-foreground">Recurring item not found.</p>
      </div>
    );
  }

  const getCategoryName = (catId: string | null) =>
    catId ? (categories.find((c) => c.id === catId)?.name ?? 'Unknown') : '-';

  const getScheduleDescription = () => {
    const freq = frequencyLabels[item.frequency];
    if (item.frequency === 'weekly' || item.frequency === 'fortnightly') {
      return `${freq} on ${dayOfWeekLabels[item.dayOfWeek ?? 0]}`;
    }
    if (item.dayOfMonth) {
      const suffix =
        item.dayOfMonth === 1 || item.dayOfMonth === 21 || item.dayOfMonth === 31
          ? 'st'
          : item.dayOfMonth === 2 || item.dayOfMonth === 22
            ? 'nd'
            : item.dayOfMonth === 3 || item.dayOfMonth === 23
              ? 'rd'
              : 'th';
      return `${freq} on the ${item.dayOfMonth}${suffix}`;
    }
    return freq;
  };

  const handleSave = () => {
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!amount || parseCentsFromInput(amount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    updateRecurringItem(item.id, {
      type,
      name: name.trim(),
      amountCents: parseCentsFromInput(amount),
      frequency,
      ...(frequency === 'weekly' || frequency === 'fortnightly'
        ? { dayOfWeek: parseInt(dayOfWeek, 10) }
        : { dayOfMonth: parseInt(dayOfMonth, 10) }),
      categoryId: categoryId || null,
    });
    setEditing(false);
  };

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteRecurringItem(item.id);
    navigate('/manage/recurring');
  };

  const handleToggleActive = () => {
    updateRecurringItem(item.id, { isActive: !item.isActive });
  };

  const startEditing = () => {
    setType(item.type);
    setName(item.name);
    setAmount((item.amountCents / 100).toFixed(2));
    setFrequency(item.frequency);
    setDayOfMonth((item.dayOfMonth ?? 1).toString());
    setDayOfWeek((item.dayOfWeek ?? 1).toString());
    setCategoryId(item.categoryId ?? '');
    setEditing(true);
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

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{item.name}</h1>
            {item.type === 'income' ? (
              <Badge variant="success">Income</Badge>
            ) : (
              <Badge variant="destructive">Expense</Badge>
            )}
            {!item.isActive && <Badge variant="outline">Paused</Badge>}
          </div>
          <p className="text-muted-foreground">{getScheduleDescription()}</p>
        </div>
        <div
          className={`text-2xl font-bold ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}
        >
          {item.type === 'income' ? '+' : '-'}
          {formatCents(item.amountCents)}
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      <Separator className="my-6" />

      {/* Edit Section */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Details</h2>
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              Edit
            </Button>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-4">
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
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(v) => setFrequency(v as RecurringFrequency)}
              >
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
              <Label htmlFor="category">Category</Label>
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
              <span className="text-muted-foreground">Type:</span>{' '}
              {item.type === 'income' ? 'Income' : 'Expense'}
            </p>
            <p>
              <span className="text-muted-foreground">Amount:</span> {formatCents(item.amountCents)}
            </p>
            <p>
              <span className="text-muted-foreground">Frequency:</span>{' '}
              {frequencyLabels[item.frequency]}
            </p>
            <p>
              <span className="text-muted-foreground">Schedule:</span> {getScheduleDescription()}
            </p>
            <p>
              <span className="text-muted-foreground">Category:</span>{' '}
              {getCategoryName(item.categoryId)}
            </p>
            <p>
              <span className="text-muted-foreground">Status:</span>{' '}
              {item.isActive ? 'Active' : 'Paused'}
            </p>
          </div>
        )}
      </section>

      <Separator className="my-6" />

      {/* Actions */}
      <section>
        <h2 className="text-lg font-semibold">Actions</h2>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <h3 className="font-medium">{item.isActive ? 'Pause' : 'Resume'}</h3>
              <p className="text-sm text-muted-foreground">
                {item.isActive
                  ? 'Temporarily stop this from being imported.'
                  : 'Resume importing this recurring item.'}
              </p>
            </div>
            <Button variant="outline" onClick={handleToggleActive}>
              {item.isActive ? 'Pause' : 'Resume'}
            </Button>
          </div>
        </div>
      </section>

      <Separator className="my-6" />

      {/* Danger Zone */}
      <section>
        <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
        <div className="mt-4 rounded-lg border border-destructive/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Delete Recurring Item</h3>
              <p className="text-sm text-muted-foreground">
                Permanently delete this recurring item.
              </p>
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
