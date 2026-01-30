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
import { parseCentsFromInput } from '@/lib/utils';
import type { ForecastRule, ForecastType, Cadence, CreateEntity } from '@/lib/types';

interface ForecastRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioId: string | null;
  rule?: ForecastRule | null;
  addRule: (data: CreateEntity<ForecastRule>) => Promise<ForecastRule>;
  updateRule: (id: string, updates: Partial<Omit<ForecastRule, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ForecastRuleDialog({ open, onOpenChange, scenarioId, rule, addRule, updateRule }: ForecastRuleDialogProps) {
  const isEditing = !!rule;

  // Form state
  const [type, setType] = useState<ForecastType>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [monthOfYear, setMonthOfYear] = useState('0');
  const [monthOfQuarter, setMonthOfQuarter] = useState('0');
  const [categoryId, setCategoryId] = useState('');
  const [savingsGoalId, setSavingsGoalId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (rule) {
        setType(rule.type);
        setDescription(rule.description);
        setAmount((rule.amountCents / 100).toFixed(2));
        setCadence(rule.cadence);
        setDayOfMonth(String(rule.dayOfMonth ?? 1));
        setDayOfWeek(String(rule.dayOfWeek ?? 1));
        setMonthOfYear(String(rule.monthOfYear ?? 0));
        setMonthOfQuarter(String(rule.monthOfQuarter ?? 0));
        setCategoryId(rule.categoryId ?? '');
        setSavingsGoalId(rule.savingsGoalId ?? '');
      } else {
        setType('expense');
        setDescription('');
        setAmount('');
        setCadence('monthly');
        setDayOfMonth('1');
        setDayOfWeek('1');
        setMonthOfYear('0');
        setMonthOfQuarter('0');
        setCategoryId('');
        setSavingsGoalId('');
      }
      setFormError(null);
    }
  }, [open, rule]);

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

    const data: Parameters<typeof addRule>[0] = {
      scenarioId,
      type,
      description: description.trim(),
      amountCents,
      cadence,
      categoryId: type === 'savings' ? null : categoryId || null,
      savingsGoalId: type === 'savings' ? savingsGoalId : null,
    };

    // Add schedule fields based on cadence
    if (cadence === 'weekly' || cadence === 'fortnightly') {
      data.dayOfWeek = parseInt(dayOfWeek, 10);
    } else {
      data.dayOfMonth = parseInt(dayOfMonth, 10);
    }

    if (cadence === 'yearly') {
      data.monthOfYear = parseInt(monthOfYear, 10);
    }

    if (cadence === 'quarterly') {
      data.monthOfQuarter = parseInt(monthOfQuarter, 10);
    }

    if (isEditing && rule) {
      await updateRule(rule.id, data);
    } else {
      await addRule(data);
    }

    onOpenChange(false);
  };

  const showDayOfWeek = cadence === 'weekly' || cadence === 'fortnightly';
  const showMonthOfYear = cadence === 'yearly';
  const showMonthOfQuarter = cadence === 'quarterly';
  const showDayOfMonth = cadence === 'monthly' || cadence === 'quarterly' || cadence === 'yearly';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Add'} Recurring Forecast</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the recurring forecast.' : 'Add a recurring income, expense, or savings pattern.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="rule-description" className="select-none">Description</Label>
            <Input
              id="rule-description"
              placeholder="e.g., Salary, Rent, Car payment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

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
              <Label htmlFor="rule-amount" className="select-none">Amount ($)</Label>
              <Input
                id="rule-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="select-none">Frequency</Label>
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
          </div>

          {/* Schedule fields based on cadence */}
          {showMonthOfYear && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="select-none">Month</Label>
                <Select value={monthOfYear} onValueChange={setMonthOfYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="select-none">Day</Label>
                <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={String(day)}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {showMonthOfQuarter && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="select-none">Month of Quarter</Label>
                <Select value={monthOfQuarter} onValueChange={setMonthOfQuarter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">1st month</SelectItem>
                    <SelectItem value="1">2nd month</SelectItem>
                    <SelectItem value="2">3rd month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="select-none">Day</Label>
                <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={String(day)}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {cadence === 'monthly' && showDayOfMonth && !showMonthOfYear && !showMonthOfQuarter && (
            <div className="space-y-2">
              <Label className="select-none">Day of Month</Label>
              <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={String(day)}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showDayOfWeek && (
            <div className="space-y-2">
              <Label className="select-none">Day of Week</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((name, i) => (
                    <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
              {isEditing ? 'Save' : 'Add'} Rule
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
