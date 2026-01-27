import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate, useOutletContext } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft } from 'lucide-react';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { formatCents, formatDate } from '@/lib/utils';
import { FormField, FormError } from '@/components/form-field';
import { savingsGoalEditSchema, parseCents } from '@/lib/schemas';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

export function SavingsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeScenarioId, startDate, endDate } = useOutletContext<OutletContext>();
  const { savingsGoals, updateSavingsGoal, deleteSavingsGoal } = useSavingsGoals();
  const { savingsTransactions } = useTransactions(startDate, endDate);
  const { savingsForecasts } = useForecasts(activeScenarioId, startDate, endDate);

  const goal = savingsGoals.find((g) => g.id === id);

  // Calculate current amount from savings transactions in the date range
  const currentAmountFromTransactions = useMemo(() => {
    if (!goal) return 0;
    return savingsTransactions
      .filter((t) => t.savingsGoalId === goal.id)
      .reduce((sum, t) => sum + t.amountCents, 0);
  }, [savingsTransactions, goal]);

  // Calculate forecasted amount
  const forecastedAmount = useMemo(() => {
    if (!goal) return 0;
    return savingsForecasts
      .filter((f) => f.savingsGoalId === goal.id)
      .reduce((sum, f) => sum + f.amountCents, 0);
  }, [savingsForecasts, goal]);

  const [editing, setEditing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const form = useForm({
    defaultValues: {
      name: goal?.name ?? '',
      targetAmount: goal ? (goal.targetAmountCents / 100).toFixed(2) : '',
      deadline: goal?.deadline ?? '',
    },
    validators: {
      onSubmit: ({ value }) => {
        const result = savingsGoalEditSchema.safeParse(value);
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
      if (!goal) return;

      updateSavingsGoal(goal.id, {
        name: value.name.trim(),
        targetAmountCents: parseCents(value.targetAmount),
        ...(value.deadline ? { deadline: value.deadline } : {}),
      });
      setEditing(false);
    },
  });

  // Reset form when goal changes or when starting to edit
  useEffect(() => {
    if (goal) {
      form.reset();
      form.setFieldValue('name', goal.name);
      form.setFieldValue('targetAmount', (goal.targetAmountCents / 100).toFixed(2));
      form.setFieldValue('deadline', goal.deadline ?? '');
    }
  }, [goal?.id]);

  if (!goal) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="mb-8">
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link to="/savings">
              <ArrowLeft className="h-4 w-4" />
              Back to Savings
            </Link>
          </Button>
        </div>
        <p className="text-muted-foreground">Savings goal not found.</p>
      </div>
    );
  }

  const actualPercent =
    goal.targetAmountCents === 0
      ? 100
      : Math.min((currentAmountFromTransactions / goal.targetAmountCents) * 100, 100);

  const forecastedPercent =
    goal.targetAmountCents > 0
      ? Math.min(100 - actualPercent, (forecastedAmount / goal.targetAmountCents) * 100)
      : 0;

  const progress = Math.round(actualPercent);

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteSavingsGoal(goal.id);
    navigate('/savings');
  };

  const startEditing = () => {
    form.reset();
    form.setFieldValue('name', goal.name);
    form.setFieldValue('targetAmount', (goal.targetAmountCents / 100).toFixed(2));
    form.setFieldValue('deadline', goal.deadline ?? '');
    setEditing(true);
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link to="/savings">
            <ArrowLeft className="h-4 w-4" />
            Back to Savings
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{goal.name}</h1>
          <p className="text-muted-foreground">
            {goal.deadline && `Deadline: ${formatDate(goal.deadline)}`}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-6 rounded-lg border p-4">
        <div className="flex justify-between text-sm">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div className="flex h-full">
            <div
              className="bg-blue-600 transition-all"
              style={{ width: `${actualPercent}%` }}
            />
            {forecastedPercent > 0 && (
              <div
                className="bg-blue-300 transition-all"
                style={{ width: `${forecastedPercent}%` }}
              />
            )}
          </div>
        </div>
        <div className="mt-2 flex justify-between text-sm text-muted-foreground">
          <span>{formatCents(currentAmountFromTransactions)} saved</span>
          <span>{formatCents(goal.targetAmountCents)} goal</span>
        </div>
        {forecastedAmount > 0 && (
          <p className="mt-2 text-sm text-blue-600">
            +{formatCents(forecastedAmount)} forecasted
          </p>
        )}
      </div>

      {submitError && <FormError error={submitError} />}

      <Separator className="my-6" />

      {/* Edit Section */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Goal Details</h2>
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
            <form.Field name="name">
              {(field) => (
                <FormField field={field} label="Name">
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </FormField>
              )}
            </form.Field>

            <form.Field name="targetAmount">
              {(field) => (
                <FormField field={field} label="Target Amount ($)">
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

            <form.Field name="deadline">
              {(field) => (
                <FormField field={field} label="Deadline" optional>
                  <Input
                    id={field.name}
                    type="date"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </FormField>
              )}
            </form.Field>

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
              <span className="text-muted-foreground">Name:</span> {goal.name}
            </p>
            <p>
              <span className="text-muted-foreground">Target:</span>{' '}
              {formatCents(goal.targetAmountCents)}
            </p>
            <p>
              <span className="text-muted-foreground">Saved:</span>{' '}
              {formatCents(currentAmountFromTransactions)}
            </p>
            {forecastedAmount > 0 && (
              <p>
                <span className="text-muted-foreground">Forecasted:</span>{' '}
                +{formatCents(forecastedAmount)}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Deadline:</span>{' '}
              {goal.deadline ? formatDate(goal.deadline) : 'None'}
            </p>
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
              <h3 className="font-medium">Delete Goal</h3>
              <p className="text-sm text-muted-foreground">Permanently delete this savings goal.</p>
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
