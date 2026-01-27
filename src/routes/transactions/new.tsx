import { Link, useNavigate } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CategorySelect } from '@/components/category-select';
import { SavingsGoalSelect } from '@/components/savings-goal-select';
import { FormField, FormError } from '@/components/form-field';
import { ArrowLeft } from 'lucide-react';
import { useTransactions } from '@/hooks/use-transactions';
import { today } from '@/lib/utils';
import { transactionFormSchema, parseCents } from '@/lib/schemas';
import type { TransactionType } from '@/lib/types';
import { useState } from 'react';

export function TransactionNewPage() {
  const navigate = useNavigate();
  const { addTransaction } = useTransactions();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const todayDate = today();

  const form = useForm({
    defaultValues: {
      type: 'expense' as TransactionType,
      date: todayDate,
      description: '',
      amount: '',
      categoryId: '',
      savingsGoalId: '',
    },
    validators: {
      onSubmit: ({ value }) => {
        const result = transactionFormSchema.safeParse(value);
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

      // Additional validation: date cannot be in the future
      if (value.date > todayDate) {
        setSubmitError('Transaction date cannot be in the future');
        return;
      }

      const transaction = addTransaction({
        type: value.type,
        date: value.date,
        description: value.description.trim(),
        amountCents: parseCents(value.amount),
        categoryId: value.type === 'savings' ? null : value.categoryId || null,
        savingsGoalId: value.type === 'savings' ? value.savingsGoalId : null,
      });

      navigate(`/transactions/${transaction.id}`);
    },
  });

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link to="/transactions">
            <ArrowLeft className="h-4 w-4" />
            Back to Transactions
          </Link>
        </Button>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">New Transaction</h1>
        <p className="mt-1 text-muted-foreground">Record an income or expense.</p>
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
                onValueChange={(v) => field.handleChange(v as TransactionType)}
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

        <div className="grid gap-6 sm:grid-cols-2">
          <form.Field name="date">
            {(field) => (
              <FormField field={field} label="Date">
                <Input
                  id={field.name}
                  type="date"
                  max={todayDate}
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
                  placeholder="0.00"
                />
              </FormField>
            )}
          </form.Field>
        </div>

        <form.Field name="description">
          {(field) => (
            <FormField field={field} label="Description">
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="e.g., Woolworths, Salary"
              />
            </FormField>
          )}
        </form.Field>

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
                {isSubmitting ? 'Creating...' : 'Create Transaction'}
              </Button>
            )}
          </form.Subscribe>
          <Button type="button" variant="outline" asChild>
            <Link to="/transactions">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
