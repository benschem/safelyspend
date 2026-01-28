import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router';
import { useForm } from '@tanstack/react-form';
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
import { CategorySelect } from '@/components/category-select';
import { SavingsGoalSelect } from '@/components/savings-goal-select';
import { ArrowLeft, Plus } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { useForecasts } from '@/hooks/use-forecasts';
import { FormField, FormError } from '@/components/form-field';
import { forecastRuleFormSchema, parseCents } from '@/lib/schemas';
import type { ForecastType, Cadence } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

export function RecurringNewPage() {
  const navigate = useNavigate();
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { addRule } = useForecasts(activeScenarioId);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      type: 'expense' as ForecastType,
      description: '',
      amount: '',
      cadence: 'monthly' as Cadence,
      dayOfMonth: '1',
      dayOfWeek: '0',
      monthOfYear: '0',
      monthOfQuarter: '0',
      categoryId: '',
      savingsGoalId: '',
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

      if (!activeScenarioId) {
        setSubmitError('No scenario selected');
        return;
      }

      addRule({
        scenarioId: activeScenarioId,
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

      navigate('/forecasts');
    },
  });

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No scenario selected</h2>
        <p className="text-muted-foreground">Select a scenario first.</p>
      </div>
    );
  }

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

      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Plus className="h-7 w-7" />
          New Recurring Forecast
        </h1>
        <p className="mt-1 text-muted-foreground">
          Add a recurring income, expense, or savings pattern.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        noValidate
        className="space-y-6"
      >
        <FormError error={submitError} />

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
                placeholder="e.g., Salary, Rent, Car payment"
              />
            </FormField>
          )}
        </form.Field>

        <div className="grid gap-6 sm:grid-cols-2">
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
                  placeholder="0.00"
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
        </div>

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
                            <SelectItem value="0">Sunday</SelectItem>
                            <SelectItem value="1">Monday</SelectItem>
                            <SelectItem value="2">Tuesday</SelectItem>
                            <SelectItem value="3">Wednesday</SelectItem>
                            <SelectItem value="4">Thursday</SelectItem>
                            <SelectItem value="5">Friday</SelectItem>
                            <SelectItem value="6">Saturday</SelectItem>
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
                  <FormField field={field} label="Category" optional={typeValue === 'income'}>
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
                {isSubmitting ? 'Creating...' : 'Create'}
              </Button>
            )}
          </form.Subscribe>
          <Button type="button" variant="outline" asChild>
            <Link to="/forecasts">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
