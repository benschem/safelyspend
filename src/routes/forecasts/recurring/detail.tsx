import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useOutletContext } from 'react-router';
import { useForm } from '@tanstack/react-form';
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
import { CategorySelect } from '@/components/category-select';
import { SavingsGoalSelect } from '@/components/savings-goal-select';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { formatCents } from '@/lib/utils';
import { FormField, FormError } from '@/components/form-field';
import { forecastRuleFormSchema, parseCents } from '@/lib/schemas';
import type { ForecastType, Cadence } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

const CADENCE_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_OF_QUARTER_LABELS = [
  '1st month (Jan, Apr, Jul, Oct)',
  '2nd month (Feb, May, Aug, Nov)',
  '3rd month (Mar, Jun, Sep, Dec)',
];

export function RecurringDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { rules, updateRule, deleteRule } = useForecasts(activeScenarioId);
  const { categories } = useCategories();
  const { savingsGoals } = useSavingsGoals();

  const rule = rules.find((r) => r.id === id);

  const [editing, setEditing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const form = useForm({
    defaultValues: {
      type: (rule?.type ?? 'expense') as ForecastType,
      description: rule?.description ?? '',
      amount: rule ? (rule.amountCents / 100).toFixed(2) : '',
      cadence: (rule?.cadence ?? 'monthly') as Cadence,
      dayOfMonth: String(rule?.dayOfMonth ?? 1),
      dayOfWeek: String(rule?.dayOfWeek ?? 0),
      monthOfYear: String(rule?.monthOfYear ?? 0),
      monthOfQuarter: String(rule?.monthOfQuarter ?? 0),
      categoryId: rule?.categoryId ?? '',
      savingsGoalId: rule?.savingsGoalId ?? '',
    },
    validators: {
      onSubmit: ({ value }) => {
        const result = forecastRuleFormSchema.safeParse(value);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          for (const issue of result.error.issues) {
            const path = issue.path.join('.');
            if (path) {
              fieldErrors[path] = issue.message;
            }
          }
          return fieldErrors;
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      if (!rule) return;

      updateRule(rule.id, {
        type: value.type,
        description: value.description.trim(),
        amountCents: parseCents(value.amount),
        cadence: value.cadence,
        ...(value.cadence === 'monthly' || value.cadence === 'quarterly' || value.cadence === 'yearly'
          ? { dayOfMonth: parseInt(value.dayOfMonth, 10) }
          : {}),
        ...(value.cadence === 'weekly' || value.cadence === 'fortnightly'
          ? { dayOfWeek: parseInt(value.dayOfWeek, 10) }
          : {}),
        ...(value.cadence === 'yearly' ? { monthOfYear: parseInt(value.monthOfYear, 10) } : {}),
        ...(value.cadence === 'quarterly'
          ? { monthOfQuarter: parseInt(value.monthOfQuarter, 10) }
          : {}),
        categoryId: value.type === 'savings' ? null : value.categoryId || null,
        savingsGoalId: value.type === 'savings' ? value.savingsGoalId : null,
      });
      setEditing(false);
    },
  });

  // Reset form when rule changes
  useEffect(() => {
    if (rule) {
      form.reset();
      form.setFieldValue('type', rule.type);
      form.setFieldValue('description', rule.description);
      form.setFieldValue('amount', (rule.amountCents / 100).toFixed(2));
      form.setFieldValue('cadence', rule.cadence);
      form.setFieldValue('dayOfMonth', String(rule.dayOfMonth ?? 1));
      form.setFieldValue('dayOfWeek', String(rule.dayOfWeek ?? 0));
      form.setFieldValue('monthOfYear', String(rule.monthOfYear ?? 0));
      form.setFieldValue('monthOfQuarter', String(rule.monthOfQuarter ?? 0));
      form.setFieldValue('categoryId', rule.categoryId ?? '');
      form.setFieldValue('savingsGoalId', rule.savingsGoalId ?? '');
    }
  }, [rule?.id]);

  if (!rule) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="mb-8">
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link to="/forecasts">
              <ArrowLeft className="h-4 w-4" />
              Back to Forecasts
            </Link>
          </Button>
        </div>
        <p className="text-muted-foreground">Recurring forecast not found.</p>
      </div>
    );
  }

  const getCategoryName = (catId: string | null) =>
    catId ? (categories.find((c) => c.id === catId)?.name ?? 'Unknown') : '-';
  const getSavingsGoalName = (goalId: string | null) =>
    goalId ? (savingsGoals.find((g) => g.id === goalId)?.name ?? 'Unknown') : '-';

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteRule(rule.id);
    navigate('/forecasts');
  };

  const startEditing = () => {
    form.reset();
    form.setFieldValue('type', rule.type);
    form.setFieldValue('description', rule.description);
    form.setFieldValue('amount', (rule.amountCents / 100).toFixed(2));
    form.setFieldValue('cadence', rule.cadence);
    form.setFieldValue('dayOfMonth', String(rule.dayOfMonth ?? 1));
    form.setFieldValue('dayOfWeek', String(rule.dayOfWeek ?? 0));
    form.setFieldValue('monthOfYear', String(rule.monthOfYear ?? 0));
    form.setFieldValue('monthOfQuarter', String(rule.monthOfQuarter ?? 0));
    form.setFieldValue('categoryId', rule.categoryId ?? '');
    form.setFieldValue('savingsGoalId', rule.savingsGoalId ?? '');
    setEditing(true);
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link to="/forecasts">
            <ArrowLeft className="h-4 w-4" />
            Back to Forecasts
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500/10">
              <RefreshCw className="h-5 w-5 text-slate-500" />
            </div>
            <h1 className="text-3xl font-bold">{rule.description}</h1>
            {rule.type === 'income' ? (
              <Badge variant="success">Income</Badge>
            ) : rule.type === 'savings' ? (
              <Badge variant="info">Savings</Badge>
            ) : (
              <Badge variant="destructive">Expense</Badge>
            )}
          </div>
          <p className="mt-1 text-muted-foreground">{CADENCE_LABELS[rule.cadence]}</p>
        </div>
        <div
          className={`text-2xl font-bold ${
            rule.type === 'income'
              ? 'text-green-600'
              : rule.type === 'savings'
                ? 'text-blue-600'
                : 'text-red-600'
          }`}
        >
          {rule.type === 'income' ? '+' : '-'}
          {formatCents(rule.amountCents)}
        </div>
      </div>

      {submitError && (
        <div className="mt-4">
          <FormError error={submitError} />
        </div>
      )}

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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            noValidate
            className="mt-4 space-y-4"
          >
            <form.Field name="type">
              {(field) => (
                <FormField field={field} label="Type">
                  <RadioGroup
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as ForecastType)}
                    className="flex gap-6 pt-1"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="expense" id="expense" />
                      <Label htmlFor="expense" className="cursor-pointer font-normal">
                        Expense
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="income" id="income" />
                      <Label htmlFor="income" className="cursor-pointer font-normal">
                        Income
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="savings" id="savings" />
                      <Label htmlFor="savings" className="cursor-pointer font-normal">
                        Savings
                      </Label>
                    </div>
                  </RadioGroup>
                </FormField>
              )}
            </form.Field>

            <form.Field name="description">
              {(field) => (
                <FormField field={field} label="Description">
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </FormField>
              )}
            </form.Field>

            <form.Field name="amount">
              {(field) => (
                <FormField field={field} label="Amount ($)">
                  <Input
                    id={field.name}
                    type="number"
                    step="0.01"
                    min="0"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </FormField>
              )}
            </form.Field>

            <form.Field name="cadence">
              {(field) => (
                <FormField field={field} label="Frequency">
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as Cadence)}
                  >
                    <SelectTrigger className="h-10">
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
                </FormField>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => state.values.cadence}>
              {(cadence) => {
                const showDayOfWeek = cadence === 'weekly' || cadence === 'fortnightly';
                const showMonthOfYear = cadence === 'yearly';
                const showMonthOfQuarter = cadence === 'quarterly';

                const dayOfMonthField = (
                  <form.Field name="dayOfMonth">
                    {(field) => (
                      <FormField field={field} label="Day">
                        <Select value={field.state.value} onValueChange={field.handleChange}>
                          <SelectTrigger className="h-10">
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
                      </FormField>
                    )}
                  </form.Field>
                );

                return (
                  <>
                    {showMonthOfYear && (
                      <div className="grid gap-6 sm:grid-cols-2">
                        <form.Field name="monthOfYear">
                          {(field) => (
                            <FormField field={field} label="Month">
                              <Select value={field.state.value} onValueChange={field.handleChange}>
                                <SelectTrigger className="h-10">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">January</SelectItem>
                                  <SelectItem value="1">February</SelectItem>
                                  <SelectItem value="2">March</SelectItem>
                                  <SelectItem value="3">April</SelectItem>
                                  <SelectItem value="4">May</SelectItem>
                                  <SelectItem value="5">June</SelectItem>
                                  <SelectItem value="6">July</SelectItem>
                                  <SelectItem value="7">August</SelectItem>
                                  <SelectItem value="8">September</SelectItem>
                                  <SelectItem value="9">October</SelectItem>
                                  <SelectItem value="10">November</SelectItem>
                                  <SelectItem value="11">December</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormField>
                          )}
                        </form.Field>
                        {dayOfMonthField}
                      </div>
                    )}

                    {showMonthOfQuarter && (
                      <div className="grid gap-6 sm:grid-cols-2">
                        <form.Field name="monthOfQuarter">
                          {(field) => (
                            <FormField field={field} label="Month of Quarter">
                              <Select value={field.state.value} onValueChange={field.handleChange}>
                                <SelectTrigger className="h-10">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">1st month</SelectItem>
                                  <SelectItem value="1">2nd month</SelectItem>
                                  <SelectItem value="2">3rd month</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormField>
                          )}
                        </form.Field>
                        {dayOfMonthField}
                      </div>
                    )}

                    {cadence === 'monthly' && dayOfMonthField}

                    {showDayOfWeek && (
                      <form.Field name="dayOfWeek">
                        {(field) => (
                          <FormField field={field} label="Day of Week">
                            <Select value={field.state.value} onValueChange={field.handleChange}>
                              <SelectTrigger className="h-10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DAY_LABELS.map((day, index) => (
                                  <SelectItem key={index} value={String(index)}>
                                    {day}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormField>
                        )}
                      </form.Field>
                    )}
                  </>
                );
              }}
            </form.Subscribe>

            <form.Subscribe selector={(state) => state.values.type}>
              {(typeValue) =>
                typeValue === 'savings' ? (
                  <form.Field name="savingsGoalId">
                    {(field) => (
                      <FormField field={field} label="Savings Goal">
                        <SavingsGoalSelect
                          value={field.state.value}
                          onChange={(v) => field.handleChange(v)}
                        />
                      </FormField>
                    )}
                  </form.Field>
                ) : (
                  <form.Field name="categoryId">
                    {(field) => (
                      <FormField field={field} label="Category" optional>
                        <CategorySelect
                          value={field.state.value}
                          onChange={(v) => field.handleChange(v)}
                          allowNone
                        />
                      </FormField>
                    )}
                  </form.Field>
                )
              }
            </form.Subscribe>

            <div className="flex gap-3 pt-2">
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </Button>
                )}
              </form.Subscribe>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Type:</span>{' '}
              {rule.type === 'income' ? 'Income' : rule.type === 'savings' ? 'Savings' : 'Expense'}
            </p>
            <p>
              <span className="text-muted-foreground">Description:</span> {rule.description}
            </p>
            <p>
              <span className="text-muted-foreground">Amount:</span> {formatCents(rule.amountCents)}
            </p>
            <p>
              <span className="text-muted-foreground">Frequency:</span>{' '}
              {CADENCE_LABELS[rule.cadence]}
            </p>
            {rule.cadence === 'yearly' && (
              <p>
                <span className="text-muted-foreground">Month:</span>{' '}
                {MONTH_LABELS[rule.monthOfYear ?? 0]}
              </p>
            )}
            {rule.cadence === 'quarterly' && (
              <p>
                <span className="text-muted-foreground">Month of Quarter:</span>{' '}
                {MONTH_OF_QUARTER_LABELS[rule.monthOfQuarter ?? 0]}
              </p>
            )}
            {(rule.cadence === 'monthly' ||
              rule.cadence === 'quarterly' ||
              rule.cadence === 'yearly') && (
              <p>
                <span className="text-muted-foreground">Day of Month:</span> {rule.dayOfMonth ?? 1}
              </p>
            )}
            {(rule.cadence === 'weekly' || rule.cadence === 'fortnightly') && (
              <p>
                <span className="text-muted-foreground">Day of Week:</span>{' '}
                {DAY_LABELS[rule.dayOfWeek ?? 0]}
              </p>
            )}
            {rule.type === 'savings' ? (
              <p>
                <span className="text-muted-foreground">Savings Goal:</span>{' '}
                {getSavingsGoalName(rule.savingsGoalId)}
              </p>
            ) : (
              <p>
                <span className="text-muted-foreground">Category:</span>{' '}
                {getCategoryName(rule.categoryId)}
              </p>
            )}
          </div>
        )}
      </section>

      <Separator className="my-6" />

      {/* Danger Zone */}
      <section>
        <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
        <div className="mt-4 rounded-lg border border-destructive/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Delete</h3>
              <p className="text-sm text-muted-foreground">
                Permanently delete this recurring forecast.
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
