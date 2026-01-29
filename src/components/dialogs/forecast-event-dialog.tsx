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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategorySelect } from '@/components/category-select';
import { SavingsGoalSelect } from '@/components/savings-goal-select';
import { today, parseCentsFromInput } from '@/lib/utils';
import type { ForecastEvent, ForecastType, CreateEntity } from '@/lib/types';

interface ForecastEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioId: string | null;
  event?: ForecastEvent | null;
  addEvent: (data: CreateEntity<ForecastEvent>) => Promise<ForecastEvent>;
  updateEvent: (id: string, updates: Partial<Omit<ForecastEvent, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
}

export function ForecastEventDialog({ open, onOpenChange, scenarioId, event, addEvent, updateEvent }: ForecastEventDialogProps) {
  const isEditing = !!event;
  const todayDate = today();

  // Form state
  const [type, setType] = useState<ForecastType>('expense');
  const [date, setDate] = useState(todayDate);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [savingsGoalId, setSavingsGoalId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (event) {
        setType(event.type);
        setDate(event.date);
        setDescription(event.description);
        setAmount((event.amountCents / 100).toFixed(2));
        setCategoryId(event.categoryId ?? '');
        setSavingsGoalId(event.savingsGoalId ?? '');
      } else {
        setType('expense');
        setDate(todayDate);
        setDescription('');
        setAmount('');
        setCategoryId('');
        setSavingsGoalId('');
      }
      setFormError(null);
    }
  }, [open, event, todayDate]);

  const handleSave = async () => {
    setFormError(null);

    if (!scenarioId) {
      setFormError('No scenario selected');
      return;
    }

    if (!description.trim()) {
      setFormError('Please enter a description');
      return;
    }

    const amountCents = parseCentsFromInput(amount);
    if (amountCents <= 0) {
      setFormError('Please enter a valid amount');
      return;
    }

    if (type === 'savings' && !savingsGoalId) {
      setFormError('Please select a savings goal');
      return;
    }

    const data = {
      scenarioId,
      type,
      date,
      description: description.trim(),
      amountCents,
      categoryId: type === 'savings' ? null : categoryId || null,
      savingsGoalId: type === 'savings' ? savingsGoalId : null,
    };

    if (isEditing && event) {
      await updateEvent(event.id, data);
    } else {
      await addEvent(data);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Add'} One-Time Event</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the forecast event.' : 'Add a one-time forecast (not recurring).'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="space-y-2">
            <Label className="select-none">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ForecastType)}>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event-date" className="select-none">Date</Label>
              <Input
                id="event-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-amount" className="select-none">Amount ($)</Label>
              <Input
                id="event-amount"
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
            <Label htmlFor="event-description" className="select-none">Description</Label>
            <Input
              id="event-description"
              placeholder="e.g., Car service, Tax return"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {isEditing ? 'Save' : 'Add'} Event
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
