import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { ScheduleDayFields } from '@/components/dialogs/schedule-day-fields';
import { parseCentsFromInput, formatCents, CADENCE_PER_LABELS } from '@/lib/utils';
import { isAllowanceNameTaken } from '@/lib/allowances';
import {
  DEFAULT_SCHEDULE_DAYS,
  scheduleDaysForCadence,
  scheduleDaysOf,
  type ScheduleDays,
} from '@/lib/cadence';
import { findSimilarForecastRules } from '@/lib/duplicate-detection';
import { toPeriodCents } from '@/lib/plan-amounts';
import { describeAverageSpending, type SpendingAverages } from '@/lib/spending-averages';
import { ruleDateRange, type Expense, type NewExpense } from '@/lib/expenses';
import type { BudgetRule, Cadence, CreateEntity, ForecastRule } from '@/lib/types';
import type { BudgetRuleUpdates } from '@/hooks/use-budget-rules';

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioId: string | null;
  // The expense to edit. Left out, the dialog adds a new one.
  expense?: Expense | null;
  // Unallocated income in cents over `period`, for the room-in-budget line
  unallocatedAmount: number;
  hasIncome: boolean;
  // The period unallocatedAmount is quoted over
  period: Cadence;
  // Every allowance in the scenario, to keep names unique within a category
  existingAllowances: BudgetRule[];
  // Every bill in the scenario, to warn of one much like the bill being added
  existingBills: ForecastRule[];
  // What each category has cost on average, shown as a guide to the amount
  spendingAverages: SpendingAverages | null;
  addBudgetRule: (data: CreateEntity<BudgetRule>) => Promise<BudgetRule>;
  updateBudgetRule: (id: string, updates: BudgetRuleUpdates) => Promise<void>;
  addRule: (data: CreateEntity<ForecastRule>) => Promise<ForecastRule>;
  updateRule: (
    id: string,
    updates: Partial<Omit<ForecastRule, 'id' | 'userId' | 'createdAt'>>,
  ) => Promise<void>;
  // Saves an edited expense whose due date was switched on or off, which
  // moves it between the bills and allowances tables
  replaceExpense: (expense: Expense, replacement: NewExpense) => Promise<void>;
  // Removes the expense being edited. The dialog closes itself afterwards.
  onRemove: (expense: Expense) => void;
}

/**
 * Adds or edits one expense on the Budget page. With a due date it is saved as
 * a bill (a forecast rule) and without one as an allowance (a budget rule).
 */
export function ExpenseDialog({
  open,
  onOpenChange,
  scenarioId,
  expense,
  unallocatedAmount,
  hasIncome,
  period,
  existingAllowances,
  existingBills,
  spendingAverages,
  addBudgetRule,
  updateBudgetRule,
  addRule,
  updateRule,
  replaceExpense,
  onRemove,
}: ExpenseDialogProps) {
  const isEditing = !!expense;

  // Form state
  // The picker creates a new category as soon as one is typed, so this is
  // always an existing id or blank.
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [hasDueDate, setHasDueDate] = useState(false);
  const [scheduleDays, setScheduleDays] = useState<ScheduleDays>(DEFAULT_SCHEDULE_DAYS);
  const [formError, setFormError] = useState<string | null>(null);

  const enteredAmountCents = parseCentsFromInput(amount);

  useEffect(() => {
    if (open) {
      if (expense?.kind === 'bill') {
        setCategoryId(expense.rule.categoryId ?? '');
        setName(expense.rule.description);
        setAmount((expense.rule.amountCents / 100).toFixed(2));
        setCadence(expense.rule.cadence);
        setHasDueDate(true);
        setScheduleDays(scheduleDaysOf(expense.rule));
      } else if (expense?.kind === 'allowance') {
        setCategoryId(expense.rule.categoryId);
        setName(expense.rule.name ?? '');
        setAmount((expense.rule.amountCents / 100).toFixed(2));
        setCadence(expense.rule.cadence);
        setHasDueDate(false);
        setScheduleDays(DEFAULT_SCHEDULE_DAYS);
      } else {
        // Create mode - reset to defaults
        setCategoryId('');
        setName('');
        setAmount('');
        setCadence('monthly');
        setHasDueDate(false);
        setScheduleDays(DEFAULT_SCHEDULE_DAYS);
      }
      setFormError(null);
    }
  }, [open, expense]);

  // A bill much like the one about to be created, whether new or an allowance
  // gaining a due date. Not checked without a due date: an allowance whose
  // name is taken in its category is refused on save instead.
  const isAlreadyBill = expense?.kind === 'bill';
  const similarBill = useMemo(() => {
    if (isAlreadyBill || !hasDueDate) return undefined;
    return findSimilarForecastRules(name, enteredAmountCents, existingBills)[0];
  }, [isAlreadyBill, hasDueDate, name, enteredAmountCents, existingBills]);

  const handleSave = async () => {
    setFormError(null);

    if (!scenarioId) {
      setFormError('Something went wrong. Please close this dialog and try again.');
      return;
    }

    if (!categoryId) {
      setFormError('Please choose a category');
      return;
    }

    const trimmedName = name.trim();
    if (hasDueDate && trimmedName === '') {
      setFormError('Please enter a name');
      return;
    }

    if (enteredAmountCents <= 0) {
      setFormError('Please enter an amount');
      return;
    }

    try {
      if (hasDueDate) {
        const billFields = {
          description: trimmedName,
          amountCents: enteredAmountCents,
          cadence,
          categoryId,
          ...scheduleDaysForCadence(cadence, scheduleDays),
        };
        const newBill = {
          scenarioId,
          type: 'expense' as const,
          savingsGoalId: null,
          ...billFields,
        };
        if (expense?.kind === 'bill') {
          await updateRule(expense.rule.id, billFields);
        } else if (expense?.kind === 'allowance') {
          // Gained a due date
          await replaceExpense(expense, {
            kind: 'bill',
            data: { ...newBill, ...ruleDateRange(expense.rule) },
          });
        } else {
          await addRule(newBill);
        }
      } else {
        // A blank name is stored as no name
        const allowanceName = trimmedName === '' ? undefined : trimmedName;
        const editedAllowance = expense?.kind === 'allowance' ? expense.rule : null;

        if (isAllowanceNameTaken(existingAllowances, categoryId, allowanceName, editedAllowance)) {
          setFormError(
            allowanceName
              ? `This category already has an expense called "${allowanceName}"`
              : 'This category already has an expense with no name. Give this one a name',
          );
          return;
        }

        const newAllowance = {
          scenarioId,
          categoryId,
          amountCents: enteredAmountCents,
          cadence,
          ...(allowanceName !== undefined && { name: allowanceName }),
        };
        if (editedAllowance) {
          await updateBudgetRule(editedAllowance.id, {
            categoryId,
            name: allowanceName,
            amountCents: enteredAmountCents,
            cadence,
          });
        } else if (expense?.kind === 'bill') {
          // Lost its due date
          await replaceExpense(expense, {
            kind: 'allowance',
            data: { ...newAllowance, ...ruleDateRange(expense.rule) },
          });
        } else {
          await addBudgetRule(newAllowance);
        }
      }
      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : `Failed to ${isEditing ? 'update' : 'add'} expense. Please try again.`,
      );
    }
  };

  const handleRemove = () => {
    if (!expense) return;
    onRemove(expense);
    onOpenChange(false);
  };

  const averageSpendingHint = describeAverageSpending(spendingAverages, categoryId, cadence);

  // What is left unallocated once this expense is saved. Both amounts are
  // converted to the page's period, which is what unallocatedAmount is in.
  const savedPeriodCents = expense
    ? toPeriodCents(expense.rule.amountCents, expense.rule.cadence, period)
    : 0;
  const unallocatedAfterSave =
    unallocatedAmount - (toPeriodCents(enteredAmountCents, cadence, period) - savedPeriodCents);
  // Shown with a blank or zero amount too, so the note does not vanish while
  // the amount is being retyped and make an overcommitted budget look fine
  const showBudgetImpact = hasIncome;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Change this expense.'
              : 'Say what it costs, then pick a category or type a new one.'}
          </DialogDescription>
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

          {similarBill && (
            <Alert variant="warning">
              A similar expense exists: &lsquo;{similarBill.description}&rsquo; for{' '}
              {formatCents(similarBill.amountCents)} {CADENCE_PER_LABELS[similarBill.cadence]}
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="expense-name" className="select-none">
              Name
              {!hasDueDate && (
                <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
              )}
            </Label>
            <Input
              id="expense-name"
              placeholder="e.g. Phone plan"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {!hasDueDate && (
              <p className="text-xs text-muted-foreground">
                Leave blank for the category&rsquo;s general spending.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expense-amount" className="select-none">
                  Amount ($)
                </Label>
                <Input
                  id="expense-amount"
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
                <Select value={cadence} onValueChange={(value) => setCadence(value as Cadence)}>
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

            {showBudgetImpact &&
              (unallocatedAfterSave >= 0 ? (
                <p className="text-xs text-green-600">
                  Room in budget: {formatCents(unallocatedAfterSave)} {CADENCE_PER_LABELS[period]}{' '}
                  remaining
                </p>
              ) : (
                <p className="text-xs text-orange-600">
                  Overcommitted by {formatCents(Math.abs(unallocatedAfterSave))}{' '}
                  {CADENCE_PER_LABELS[period]}
                </p>
              ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="expense-has-due-date" className="select-none">
                Due on a set date
              </Label>
              <Switch
                id="expense-has-due-date"
                checked={hasDueDate}
                onCheckedChange={setHasDueDate}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              On, the expense counts in the month it falls due. Off, it is spread evenly across the
              year.
            </p>
          </div>

          {hasDueDate && (
            <ScheduleDayFields cadence={cadence} days={scheduleDays} onChange={setScheduleDays} />
          )}

          <div className="space-y-2">
            <Label className="select-none">Category</Label>
            <CategorySelect value={categoryId} onChange={setCategoryId} />
          </div>

          {averageSpendingHint && (
            <p className="text-xs text-muted-foreground">{averageSpendingHint}</p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <div>
              {isEditing && (
                <Button type="button" variant="ghost" onClick={handleRemove}>
                  Remove
                </Button>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Add Expense'}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
