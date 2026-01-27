import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useTransactions } from '@/hooks/use-transactions';
import { today } from '@/lib/utils';
import { FormField, FormError } from '@/components/form-field';
import { savingsGoalFormSchema, parseCents } from '@/lib/schemas';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

export function SavingsNewPage() {
  const navigate = useNavigate();
  const { startDate } = useOutletContext<OutletContext>();
  const { addSavingsGoal } = useSavingsGoals();
  const { addTransaction } = useTransactions();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: '',
      targetAmount: '',
      startingBalance: '',
      deadline: '',
    },
    validators: {
      onSubmit: ({ value }) => {
        const result = savingsGoalFormSchema.safeParse(value);
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

      const goal = addSavingsGoal({
        name: value.name.trim(),
        targetAmountCents: parseCents(value.targetAmount),
        ...(value.deadline && { deadline: value.deadline }),
      });

      // Create starting balance transaction if amount > 0
      const startingBalanceCents = parseCents(value.startingBalance);
      if (startingBalanceCents > 0) {
        addTransaction({
          type: 'savings',
          date: startDate || today(),
          amountCents: startingBalanceCents,
          description: 'Starting balance',
          categoryId: null,
          savingsGoalId: goal.id,
        });
      }

      navigate(`/savings/${goal.id}`);
    },
  });

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

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">New Savings Goal</h1>
        <p className="mt-1 text-muted-foreground">Create a new savings target.</p>
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

        <form.Field name="name">
          {(field) => (
            <FormField field={field} label="Goal Name">
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="e.g., Emergency Fund, Holiday"
              />
            </FormField>
          )}
        </form.Field>

        <div className="grid gap-6 sm:grid-cols-2">
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
                  placeholder="0.00"
                />
              </FormField>
            )}
          </form.Field>

          <form.Field name="startingBalance">
            {(field) => (
              <FormField
                field={field}
                label="Starting Balance ($)"
                description="Amount already saved"
                optional
              >
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
        </div>

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
                {isSubmitting ? 'Creating...' : 'Create Goal'}
              </Button>
            )}
          </form.Subscribe>
          <Button type="button" variant="outline" asChild>
            <Link to="/savings">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
