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
import { today, parseCentsFromInput, cn } from '@/lib/utils';
import type { ForecastEvent, ForecastRule, ForecastType, Cadence, CreateEntity } from '@/lib/types';

type Mode = 'one-time' | 'recurring';

interface ExpectedTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioId: string | null;
  /** Event to edit (sets mode to one-time) */
  event?: ForecastEvent | null;
  /** Rule to edit (sets mode to recurring) */
  rule?: ForecastRule | null;
  addEvent: (data: CreateEntity<ForecastEvent>) => Promise<ForecastEvent>;
  updateEvent: (id: string, updates: Partial<Omit<ForecastEvent, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
  addRule: (data: CreateEntity<ForecastRule>) => Promise<ForecastRule>;
  updateRule: (id: string, updates: Partial<Omit<ForecastRule, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
  /** Called after a new rule is created (not on edit) */
  onRuleCreated?: (rule: ForecastRule) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ExpectedTransactionDialog({
  open,
  onOpenChange,
  scenarioId,
  event,
  rule,
  addEvent,
  updateEvent,
  addRule,
  updateRule,
  onRuleCreated,
}: ExpectedTransactionDialogProps) {
  const isEditingEvent = !!event;
  const isEditingRule = !!rule;
  const isEditing = isEditingEvent || isEditingRule;
  const todayDate = today();

  // Form state
  const [mode, setMode] = useState<Mode>('one-time');
  const [type, setType] = useState<ForecastType>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [savingsGoalId, setSavingsGoalId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // One-time specific
  const [date, setDate] = useState(todayDate);

  // Recurring specific
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [monthOfYear, setMonthOfYear] = useState('0');
  const [monthOfQuarter, setMonthOfQuarter] = useState('0');

  useEffect(() => {
    if (open) {
      if (event) {
        // Editing existing event - set to one-time mode
        setMode('one-time');
        setType(event.type);
        setDescription(event.description);
        setAmount((event.amountCents / 100).toFixed(2));
        setCategoryId(event.categoryId ?? '');
        setSavingsGoalId(event.savingsGoalId ?? '');
        setDate(event.date);
        // Reset recurring fields
        setCadence('monthly');
        setDayOfMonth('1');
        setDayOfWeek('1');
        setMonthOfYear('0');
        setMonthOfQuarter('0');
      } else if (rule) {
        // Editing existing rule - set to recurring mode
        setMode('recurring');
        setType(rule.type);
        setDescription(rule.description);
        setAmount((rule.amountCents / 100).toFixed(2));
        setCategoryId(rule.categoryId ?? '');
        setSavingsGoalId(rule.savingsGoalId ?? '');
        setCadence(rule.cadence);
        setDayOfMonth(String(rule.dayOfMonth ?? 1));
        setDayOfWeek(String(rule.dayOfWeek ?? 1));
        setMonthOfYear(String(rule.monthOfYear ?? 0));
        setMonthOfQuarter(String(rule.monthOfQuarter ?? 0));
        // Reset one-time fields
        setDate(todayDate);
      } else {
        // New - default to one-time
        setMode('one-time');
        setType('expense');
        setDescription('');
        setAmount('');
        setCategoryId('');
        setSavingsGoalId('');
        setDate(todayDate);
        setCadence('monthly');
        setDayOfMonth('1');
        setDayOfWeek('1');
        setMonthOfYear('0');
        setMonthOfQuarter('0');
      }
      setFormError(null);
    }
  }, [open, event, rule, todayDate]);

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

    try {
      if (mode === 'one-time') {
        const eventData = {
          scenarioId,
          type,
          date,
          description: description.trim(),
          amountCents,
          categoryId: type === 'savings' ? null : categoryId || null,
          savingsGoalId: type === 'savings' ? savingsGoalId : null,
        };

        if (isEditingEvent && event) {
          await updateEvent(event.id, eventData);
        } else {
          await addEvent(eventData);
        }
      } else {
        // Recurring mode
        const ruleData: Parameters<typeof addRule>[0] = {
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
          ruleData.dayOfWeek = parseInt(dayOfWeek, 10);
        } else {
          ruleData.dayOfMonth = parseInt(dayOfMonth, 10);
        }

        if (cadence === 'yearly') {
          ruleData.monthOfYear = parseInt(monthOfYear, 10);
        }

        if (cadence === 'quarterly') {
          ruleData.monthOfQuarter = parseInt(monthOfQuarter, 10);
        }

        if (isEditingRule && rule) {
          await updateRule(rule.id, ruleData);
        } else {
          const newRule = await addRule(ruleData);
          onRuleCreated?.(newRule);
        }
      }
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save. Please try again.');
    }
  };

  const showDayOfWeek = cadence === 'weekly' || cadence === 'fortnightly';
  const showMonthOfYear = cadence === 'yearly';
  const showMonthOfQuarter = cadence === 'quarterly';
  const showDayOfMonth = cadence === 'monthly' || cadence === 'quarterly' || cadence === 'yearly';

  // Determine dialog title and description
  const getTitle = () => {
    if (isEditingEvent) return 'Edit Expected Transaction';
    if (isEditingRule) return 'Edit Recurring Rule';
    return 'Add Expected Transaction';
  };

  const getDescription = () => {
    if (isEditingEvent) return 'Update this expected transaction.';
    if (isEditingRule) return 'Update this recurring rule.';
    return 'Add a future expected transaction, either one-time or recurring.';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          {/* Mode toggle - only show when creating new (not editing) */}
          {!isEditing && (
            <div className="inline-flex h-10 w-full items-center rounded-lg bg-muted p-1 text-muted-foreground">
              <button
                type="button"
                onClick={() => setMode('one-time')}
                className={cn(
                  'inline-flex h-8 flex-1 cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-all',
                  mode === 'one-time'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'hover:text-foreground',
                )}
              >
                One-time
              </button>
              <button
                type="button"
                onClick={() => setMode('recurring')}
                className={cn(
                  'inline-flex h-8 flex-1 cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-all',
                  mode === 'recurring'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'hover:text-foreground',
                )}
              >
                Recurring
              </button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="expected-description" className="select-none">Description</Label>
            <Input
              id="expected-description"
              placeholder={mode === 'recurring' ? 'e.g., Salary, Rent, Car payment' : 'e.g., Car service, Tax return'}
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

          {mode === 'one-time' ? (
            // One-time fields
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expected-date" className="select-none">Date</Label>
                <Input
                  id="expected-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected-amount" className="select-none">Amount ($)</Label>
                <Input
                  id="expected-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
          ) : (
            // Recurring fields
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expected-amount-recurring" className="select-none">Amount ($)</Label>
                  <Input
                    id="expected-amount-recurring"
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
                  {parseInt(dayOfMonth, 10) > 28 && (
                    <p className="text-xs text-muted-foreground">
                      For shorter months, uses last day of month
                    </p>
                  )}
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
            </>
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
              {isEditing ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
