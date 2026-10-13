import { useState, useEffect, useMemo } from 'react';
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
import { Alert } from '@/components/ui/alert';
import { CategorySelect } from '@/components/category-select';
import { SavingsGoalSelect } from '@/components/savings-goal-select';
import { ScheduleDayFields } from '@/components/dialogs/schedule-day-fields';
import { parseCentsFromInput, formatCents, CADENCE_PER_LABELS } from '@/lib/utils';
import {
  DEFAULT_SCHEDULE_DAYS,
  scheduleDaysForCadence,
  scheduleDaysOf,
  type ScheduleDays,
} from '@/lib/cadence';
import { findSimilarForecastRules } from '@/lib/duplicate-detection';
import type { ForecastRule, ForecastType, Cadence, CreateEntity } from '@/lib/types';

/** The rule types this dialog edits. An expense rule is edited in ExpenseDialog. */
export type RecurringRuleType = Exclude<ForecastType, 'expense'>;

/** Pre-fill data for creating a rule from a one-time event */
interface PrefillData {
  type: ForecastType;
  description: string;
  amountCents: number;
  categoryId: string | null;
  savingsGoalId: string | null;
  /** Day of month extracted from event date */
  dayOfMonth?: number;
}

interface ForecastRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioId: string | null;
  rule?: ForecastRule | null;
  addRule: (data: CreateEntity<ForecastRule>) => Promise<ForecastRule>;
  updateRule: (
    id: string,
    updates: Partial<Omit<ForecastRule, 'id' | 'userId' | 'createdAt'>>,
  ) => Promise<void>;
  /** Pre-fill data when converting from a one-time event */
  prefill?: PrefillData | null;
  /** The kind of rule being added or edited. Sets the wording and the fields shown. */
  type: RecurringRuleType;
  existingRules?: ForecastRule[];
}

/**
 * What each rule type is called on screen. An expense rule is a bill to the
 * user, and a bill is recurring by definition, so it drops the word. It is
 * listed because the similar-rule warning can name one.
 */
const TYPE_NOUNS: Record<ForecastType, string> = {
  income: 'recurring income',
  expense: 'bill',
  savings: 'recurring savings contribution',
};

const TYPE_TITLES: Record<RecurringRuleType, string> = {
  income: 'Recurring Income',
  savings: 'Recurring Savings Contribution',
};

export function ForecastRuleDialog({
  open,
  onOpenChange,
  scenarioId,
  rule,
  addRule,
  updateRule,
  prefill,
  type,
  existingRules,
}: ForecastRuleDialogProps) {
  const isEditing = !!rule;

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [scheduleDays, setScheduleDays] = useState<ScheduleDays>(DEFAULT_SCHEDULE_DAYS);
  const [categoryId, setCategoryId] = useState('');
  const [savingsGoalId, setSavingsGoalId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (rule) {
        // Editing existing rule
        setDescription(rule.description);
        setAmount((rule.amountCents / 100).toFixed(2));
        setCadence(rule.cadence);
        setScheduleDays(scheduleDaysOf(rule));
        setCategoryId(rule.categoryId ?? '');
        setSavingsGoalId(rule.savingsGoalId ?? '');
      } else if (prefill) {
        // Pre-filling from a one-time event
        setDescription(prefill.description);
        setAmount((prefill.amountCents / 100).toFixed(2));
        setCadence('monthly'); // Default to monthly
        setScheduleDays({
          ...DEFAULT_SCHEDULE_DAYS,
          dayOfMonth: prefill.dayOfMonth ?? DEFAULT_SCHEDULE_DAYS.dayOfMonth,
        });
        setCategoryId(prefill.categoryId ?? '');
        setSavingsGoalId(prefill.savingsGoalId ?? '');
      } else {
        // New rule from scratch
        setDescription('');
        setAmount('');
        setCadence('monthly');
        setScheduleDays(DEFAULT_SCHEDULE_DAYS);
        setCategoryId('');
        setSavingsGoalId('');
      }
      setFormError(null);
    }
  }, [open, rule, prefill]);

  // Duplicate detection (only on create)
  const similarRules = useMemo(() => {
    if (isEditing || !existingRules) return [];
    const amountCents = parseCentsFromInput(amount);
    if (!description.trim() || amountCents <= 0) return [];
    return findSimilarForecastRules(description, amountCents, existingRules);
  }, [isEditing, existingRules, description, amount]);

  const handleSave = async () => {
    setFormError(null);

    if (!scenarioId) {
      setFormError('Something went wrong. Please close this dialog and try again.');
      return;
    }

    // Description required for income but not for savings
    if (type !== 'savings' && !description.trim()) {
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
      // For savings, description is auto-generated (not user-entered)
      description: type === 'savings' ? 'Savings contribution' : description.trim(),
      amountCents,
      cadence,
      categoryId: type === 'savings' ? null : categoryId || null,
      savingsGoalId: type === 'savings' ? savingsGoalId : null,
      ...scheduleDaysForCadence(cadence, scheduleDays),
    };

    try {
      if (isEditing && rule) {
        await updateRule(rule.id, data);
      } else {
        await addRule(data);
      }
      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Failed to save rule. Please try again.',
      );
    }
  };

  const dialogTitle = `${isEditing ? 'Edit' : 'Add'} ${TYPE_TITLES[type]}`;
  const dialogDescription = isEditing
    ? `Update this ${TYPE_NOUNS[type]}.`
    : `Add a ${TYPE_NOUNS[type]}.`;

  const similarRule = similarRules[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4"
        >
          {formError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          {similarRule && (
            <Alert variant="warning">
              A similar {TYPE_NOUNS[similarRule.type]} exists: &lsquo;
              {similarRule.description}&rsquo; for {formatCents(similarRule.amountCents)}{' '}
              {CADENCE_PER_LABELS[similarRule.cadence]}
            </Alert>
          )}

          {/* Amount - full width */}
          <div className="space-y-2">
            <Label htmlFor="rule-amount" className="select-none">
              Amount ($)
            </Label>
            <Input
              id="rule-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>

          {/* Frequency */}
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

          <ScheduleDayFields cadence={cadence} days={scheduleDays} onChange={setScheduleDays} />

          {/* Description - hidden for savings (uses goal name instead) */}
          {type !== 'savings' && (
            <div className="space-y-2">
              <Label htmlFor="rule-description" className="select-none">
                Description
              </Label>
              <Input
                id="rule-description"
                placeholder="e.g., Salary"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}

          {type === 'savings' ? (
            <div className="space-y-2">
              <Label className="select-none">Savings Goal</Label>
              <SavingsGoalSelect value={savingsGoalId} onChange={setSavingsGoalId} />
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="select-none">
                Category
                <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
              </Label>
              <CategorySelect value={categoryId} onChange={setCategoryId} allowNone />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
