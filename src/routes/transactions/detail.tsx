import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CategorySelect } from '@/components/category-select';
import { SavingsGoalSelect } from '@/components/savings-goal-select';
import { ArrowLeft } from 'lucide-react';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { formatCents, formatDate, today } from '@/lib/utils';
import { FormField, FormError } from '@/components/form-field';
import { transactionFormSchema, parseCents } from '@/lib/schemas';
import type { TransactionType } from '@/lib/types';

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { allTransactions, updateTransaction, deleteTransaction } = useTransactions();
  const { categories } = useCategories();
  const { savingsGoals } = useSavingsGoals();

  const transaction = allTransactions.find((t) => t.id === id);

  const [editing, setEditing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const todayDate = today();

  const form = useForm({
    defaultValues: {
      type: (transaction?.type ?? 'expense') as TransactionType,
      date: transaction?.date ?? '',
      description: transaction?.description ?? '',
      amount: transaction ? (transaction.amountCents / 100).toFixed(2) : '',
      categoryId: transaction?.categoryId ?? '',
      savingsGoalId: transaction?.savingsGoalId ?? '',
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
      if (!transaction) return;

      // Additional validation: date cannot be in the future
      if (value.date > todayDate) {
        setSubmitError('Transaction date cannot be in the future');
        return;
      }

      updateTransaction(transaction.id, {
        type: value.type,
        date: value.date,
        description: value.description.trim(),
        amountCents: parseCents(value.amount),
        categoryId: value.type === 'savings' ? null : value.categoryId || null,
        savingsGoalId: value.type === 'savings' ? value.savingsGoalId : null,
      });
      setEditing(false);
    },
  });

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction) {
      form.reset();
      form.setFieldValue('type', transaction.type);
      form.setFieldValue('date', transaction.date);
      form.setFieldValue('description', transaction.description);
      form.setFieldValue('amount', (transaction.amountCents / 100).toFixed(2));
      form.setFieldValue('categoryId', transaction.categoryId ?? '');
      form.setFieldValue('savingsGoalId', transaction.savingsGoalId ?? '');
    }
  }, [transaction?.id]);

  if (!transaction) {
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
        <p className="text-muted-foreground">Transaction not found.</p>
      </div>
    );
  }

  const getCategoryName = (catId: string | null) =>
    catId ? (categories.find((c) => c.id === catId)?.name ?? 'Unknown') : '-';
  const getSavingsGoalName = (goalId: string | null) =>
    goalId ? (savingsGoals.find((g) => g.id === goalId)?.name ?? 'Unknown') : '-';

  const isAdjustment = transaction?.type === 'adjustment';

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteTransaction(transaction.id);
    navigate('/transactions');
  };

  const startEditing = () => {
    form.reset();
    form.setFieldValue('type', transaction.type);
    form.setFieldValue('date', transaction.date);
    form.setFieldValue('description', transaction.description);
    form.setFieldValue('amount', (transaction.amountCents / 100).toFixed(2));
    form.setFieldValue('categoryId', transaction.categoryId ?? '');
    form.setFieldValue('savingsGoalId', transaction.savingsGoalId ?? '');
    setEditing(true);
  };

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

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{transaction.description}</h1>
            {transaction.type === 'income' ? (
              <Badge variant="success">Income</Badge>
            ) : transaction.type === 'savings' ? (
              <Badge variant="info">Savings</Badge>
            ) : transaction.type === 'adjustment' ? (
              <Badge variant="secondary">Adjustment</Badge>
            ) : (
              <Badge variant="destructive">Expense</Badge>
            )}
          </div>
          <p className="text-muted-foreground">{formatDate(transaction.date)}</p>
        </div>
        <div
          className={`text-2xl font-bold ${
            transaction.type === 'income' || transaction.type === 'adjustment'
              ? 'text-green-600'
              : transaction.type === 'savings'
                ? 'text-blue-600'
                : 'text-red-600'
          }`}
        >
          {transaction.type === 'income' || transaction.type === 'adjustment' ? '+' : '-'}
          {formatCents(transaction.amountCents)}
        </div>
      </div>

      {submitError && <div className="mt-4"><FormError error={submitError} /></div>}

      <Separator className="my-6" />

      {/* Edit Section */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Transaction Details</h2>
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
            {!isAdjustment && (
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
            )}

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
              {transaction.type === 'income'
                ? 'Income'
                : transaction.type === 'savings'
                  ? 'Savings'
                  : transaction.type === 'adjustment'
                    ? 'Adjustment'
                    : 'Expense'}
            </p>
            <p>
              <span className="text-muted-foreground">Date:</span> {formatDate(transaction.date)}
            </p>
            <p>
              <span className="text-muted-foreground">Description:</span> {transaction.description}
            </p>
            <p>
              <span className="text-muted-foreground">Amount:</span>{' '}
              {formatCents(transaction.amountCents)}
            </p>
            {transaction.type === 'savings' ? (
              <p>
                <span className="text-muted-foreground">Savings Goal:</span>{' '}
                {getSavingsGoalName(transaction.savingsGoalId)}
              </p>
            ) : transaction.type !== 'adjustment' ? (
              <p>
                <span className="text-muted-foreground">Category:</span>{' '}
                {getCategoryName(transaction.categoryId)}
              </p>
            ) : null}
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
              <h3 className="font-medium">Delete Transaction</h3>
              <p className="text-sm text-muted-foreground">Permanently delete this transaction.</p>
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
