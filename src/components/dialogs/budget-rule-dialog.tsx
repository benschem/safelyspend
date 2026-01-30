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
import { parseCentsFromInput } from '@/lib/utils';
import type { Cadence, BudgetRule } from '@/lib/types';

interface BudgetRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryName: string;
  rule: BudgetRule | null;
  setBudgetForCategory: (
    categoryId: string,
    amountCents: number,
    cadence: Cadence,
    dayOfWeek?: number,
    dayOfMonth?: number,
    monthOfQuarter?: number
  ) => Promise<void>;
  deleteBudgetRule: (id: string) => Promise<void>;
}

const DAY_OF_WEEK_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_OF_QUARTER_LABELS = ['1st month', '2nd month', '3rd month'];

const CADENCE_FULL_LABELS: Record<Cadence, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export function BudgetRuleDialog({
  open,
  onOpenChange,
  categoryId,
  categoryName,
  rule,
  setBudgetForCategory,
  deleteBudgetRule,
}: BudgetRuleDialogProps) {
  const isEditing = !!rule;

  // Form state
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [day, setDay] = useState('1');
  const [monthOfQuarter, setMonthOfQuarter] = useState('0');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (rule) {
        setAmount((rule.amountCents / 100).toFixed(2));
        setCadence(rule.cadence);
        if (rule.cadence === 'weekly' || rule.cadence === 'fortnightly') {
          setDay(String(rule.dayOfWeek ?? 1));
        } else {
          setDay(String(rule.dayOfMonth ?? 1));
        }
        setMonthOfQuarter(String(rule.monthOfQuarter ?? 0));
      } else {
        setAmount('');
        setCadence('monthly');
        setDay('1');
        setMonthOfQuarter('0');
      }
      setFormError(null);
    }
  }, [open, rule]);

  const handleSave = async () => {
    setFormError(null);

    const amountCents = parseCentsFromInput(amount);
    if (amountCents <= 0) {
      setFormError('Please enter a valid amount');
      return;
    }

    const isWeekly = cadence === 'weekly' || cadence === 'fortnightly';
    const isQuarterly = cadence === 'quarterly';

    await setBudgetForCategory(
      categoryId,
      amountCents,
      cadence,
      isWeekly ? parseInt(day) : undefined,
      isWeekly ? undefined : parseInt(day),
      isQuarterly ? parseInt(monthOfQuarter) : undefined,
    );

    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (rule) {
      await deleteBudgetRule(rule.id);
      onOpenChange(false);
    }
  };

  const isWeeklyCadence = cadence === 'weekly' || cadence === 'fortnightly';
  const isQuarterlyCadence = cadence === 'quarterly';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Set'} Spending Limit</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the spending limit for' : 'Set a spending limit for'} {categoryName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget-amount" className="select-none">Limit Amount ($)</Label>
              <Input
                id="budget-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="select-none">Cadence</Label>
              <Select
                value={cadence}
                onValueChange={(v) => {
                  setCadence(v as Cadence);
                  if (v === 'weekly' || v === 'fortnightly') {
                    setDay('1'); // Monday
                  } else {
                    setDay('1'); // 1st of month
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CADENCE_FULL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isQuarterlyCadence && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="select-none">Month of Quarter</Label>
                <Select value={monthOfQuarter} onValueChange={setMonthOfQuarter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OF_QUARTER_LABELS.map((label, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="select-none">Day</Label>
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {isWeeklyCadence && (
            <div className="space-y-2">
              <Label className="select-none">Day of Week</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OF_WEEK_LABELS.map((label, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isWeeklyCadence && !isQuarterlyCadence && (
            <div className="space-y-2">
              <Label className="select-none">Day of Month</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-between gap-3 pt-2">
            <div>
              {isEditing && (
                <Button variant="destructive" onClick={handleDelete}>
                  Remove Limit
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {isEditing ? 'Save' : 'Set'} Limit
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
