import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Check, AlertTriangle } from 'lucide-react';
import { usePeriods } from '@/hooks/use-periods';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { useOpeningBalances } from '@/hooks/use-opening-balances';
import { useBudgetLines } from '@/hooks/use-budget-lines';
import { useRecurringItems } from '@/hooks/use-recurring-items';
import { useForecasts } from '@/hooks/use-forecasts';
import { formatCents, parseCentsFromInput, formatDate } from '@/lib/utils';

export function PeriodDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { periods, activePeriodId, setActivePeriodId, updatePeriod, deletePeriod } = usePeriods();
  const { activeAccounts } = useAccounts();
  const { activeCategories } = useCategories();
  const { getBalanceForAccount, setBalanceForAccount } = useOpeningBalances(id ?? null);
  const { getBudgetForCategory, setBudgetForCategory } = useBudgetLines(id ?? null);
  const { activeItems, generateForecastsForPeriod } = useRecurringItems();
  const { forecasts, addForecast } = useForecasts(id ?? null);

  const period = periods.find((p) => p.id === id);
  const isActive = period?.id === activePeriodId;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(period?.name ?? '');
  const [startDate, setStartDate] = useState(period?.startDate ?? '');
  const [endDate, setEndDate] = useState(period?.endDate ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Opening balance editing state
  const [editingBalanceAccountId, setEditingBalanceAccountId] = useState<string | null>(null);
  const [balanceInput, setBalanceInput] = useState('');

  // Budget line editing state
  const [editingBudgetCategoryId, setEditingBudgetCategoryId] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState('');

  // Import recurring state
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Generate preview of recurring items to import
  const recurringPreview = useMemo(() => {
    if (!period) return [];
    return generateForecastsForPeriod(period.id, period.startDate, period.endDate);
  }, [period, generateForecastsForPeriod]);

  // Check for potential duplicates
  const duplicateWarnings = useMemo(() => {
    const warnings: string[] = [];
    for (const preview of recurringPreview) {
      const existing = forecasts.find(
        (f) => f.description === preview.description && f.date === preview.date,
      );
      if (existing) {
        warnings.push(`${preview.description} on ${formatDate(preview.date)}`);
      }
    }
    return warnings;
  }, [recurringPreview, forecasts]);

  if (!period) {
    return (
      <div>
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/manage/periods">
              <ArrowLeft className="h-4 w-4" />
              Back to Periods
            </Link>
          </Button>
        </div>
        <p className="text-muted-foreground">Period not found.</p>
      </div>
    );
  }

  const handleImportRecurring = () => {
    let imported = 0;
    for (const preview of recurringPreview) {
      // Skip if duplicate exists
      const existing = forecasts.find(
        (f) => f.description === preview.description && f.date === preview.date,
      );
      if (!existing) {
        addForecast({
          periodId: preview.periodId,
          type: preview.type,
          date: preview.date,
          amountCents: preview.amountCents,
          description: preview.description,
          categoryId: preview.categoryId,
          savingsGoalId: null,
          ...(preview.notes && { notes: preview.notes }),
        });
        imported++;
      }
    }
    setShowImportPreview(false);
    setImportSuccess(
      `Imported ${imported} forecast${imported !== 1 ? 's' : ''} from recurring items.`,
    );
    setTimeout(() => setImportSuccess(null), 5000);
  };

  const handleSave = () => {
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!startDate) {
      setError('Start date is required');
      return;
    }
    if (!endDate) {
      setError('End date is required');
      return;
    }
    if (startDate >= endDate) {
      setError('End date must be after start date');
      return;
    }

    updatePeriod(period.id, {
      name: name.trim(),
      startDate,
      endDate,
    });
    setEditing(false);
  };

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deletePeriod(period.id);
    navigate('/manage/periods');
  };

  const handleStartEditBalance = (accountId: string) => {
    const currentBalance = getBalanceForAccount(accountId);
    setEditingBalanceAccountId(accountId);
    setBalanceInput((currentBalance / 100).toFixed(2));
  };

  const handleSaveBalance = () => {
    if (editingBalanceAccountId) {
      const cents = parseCentsFromInput(balanceInput);
      setBalanceForAccount(editingBalanceAccountId, cents);
      setEditingBalanceAccountId(null);
      setBalanceInput('');
    }
  };

  const handleStartEditBudget = (categoryId: string) => {
    const currentBudget = getBudgetForCategory(categoryId);
    setEditingBudgetCategoryId(categoryId);
    setBudgetInput((currentBudget / 100).toFixed(2));
  };

  const handleSaveBudget = () => {
    if (editingBudgetCategoryId) {
      const cents = parseCentsFromInput(budgetInput);
      setBudgetForCategory(editingBudgetCategoryId, cents);
      setEditingBudgetCategoryId(null);
      setBudgetInput('');
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/manage/periods">
            <ArrowLeft className="h-4 w-4" />
            Back to Periods
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{period.name}</h1>
            {isActive && <Badge variant="success">Active</Badge>}
          </div>
          <p className="text-muted-foreground">
            {new Date(period.startDate).toLocaleDateString('en-AU')} -{' '}
            {new Date(period.endDate).toLocaleDateString('en-AU')}
          </p>
        </div>
        {!isActive && (
          <Button variant="outline" onClick={() => setActivePeriodId(period.id)}>
            <Check className="h-4 w-4" />
            Set as Active
          </Button>
        )}
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      <Separator className="my-6" />

      {/* Edit Section */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Period Details</h2>
          {!editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setName(period.name);
                setStartDate(period.startDate);
                setEndDate(period.endDate);
                setEditing(true);
              }}
            >
              Edit
            </Button>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave}>Save</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span> {period.name}
            </p>
            <p>
              <span className="text-muted-foreground">Start:</span>{' '}
              {new Date(period.startDate).toLocaleDateString('en-AU')}
            </p>
            <p>
              <span className="text-muted-foreground">End:</span>{' '}
              {new Date(period.endDate).toLocaleDateString('en-AU')}
            </p>
          </div>
        )}
      </section>

      <Separator className="my-6" />

      {/* Opening Balances Section */}
      <section>
        <h2 className="text-lg font-semibold">Opening Balances</h2>
        <p className="text-sm text-muted-foreground">
          Set the starting balance for each account at the beginning of this period.
        </p>

        {activeAccounts.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No accounts yet.{' '}
            <Link to="/manage/accounts/new" className="underline">
              Create an account
            </Link>
          </p>
        ) : (
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Opening Balance</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeAccounts.map((account) => {
                const isEditing = editingBalanceAccountId === account.id;
                const balance = getBalanceForAccount(account.id);
                return (
                  <TableRow key={account.id}>
                    <TableCell>{account.name}</TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={balanceInput}
                          onChange={(e) => setBalanceInput(e.target.value)}
                          className="ml-auto w-32 text-right"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveBalance();
                            if (e.key === 'Escape') setEditingBalanceAccountId(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        formatCents(balance)
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" onClick={handleSaveBalance}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingBalanceAccountId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEditBalance(account.id)}
                        >
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <Separator className="my-6" />

      {/* Budget Lines Section */}
      <section>
        <h2 className="text-lg font-semibold">Monthly Budgets</h2>
        <p className="text-sm text-muted-foreground">
          Set the monthly budget for each category in this period.
        </p>

        {activeCategories.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No categories yet.{' '}
            <Link to="/categories/new" className="underline">
              Create a category
            </Link>
          </p>
        ) : (
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Monthly Budget</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeCategories.map((category) => {
                const isEditing = editingBudgetCategoryId === category.id;
                const budget = getBudgetForCategory(category.id);
                return (
                  <TableRow key={category.id}>
                    <TableCell>{category.name}</TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={budgetInput}
                          onChange={(e) => setBudgetInput(e.target.value)}
                          className="ml-auto w-32 text-right"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveBudget();
                            if (e.key === 'Escape') setEditingBudgetCategoryId(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        formatCents(budget)
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" onClick={handleSaveBudget}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingBudgetCategoryId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEditBudget(category.id)}
                        >
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <Separator className="my-6" />

      {/* Import Recurring Section */}
      <section>
        <h2 className="text-lg font-semibold">Import Recurring Items</h2>
        <p className="text-sm text-muted-foreground">
          Generate forecasts from your recurring income and expenses.
        </p>

        {importSuccess && (
          <div className="mt-4 rounded-lg bg-green-100 p-3 text-green-800">{importSuccess}</div>
        )}

        {activeItems.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No recurring items set up.{' '}
            <Link to="/manage/recurring/new" className="underline">
              Create one
            </Link>
          </p>
        ) : !showImportPreview ? (
          <div className="mt-4">
            <Button variant="outline" onClick={() => setShowImportPreview(true)}>
              Preview Import ({activeItems.length} recurring item
              {activeItems.length !== 1 ? 's' : ''})
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {duplicateWarnings.length > 0 && (
              <div className="rounded-lg border border-yellow-500 bg-yellow-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      Some forecasts already exist and will be skipped:
                    </p>
                    <ul className="mt-1 text-sm text-yellow-700">
                      {duplicateWarnings.slice(0, 5).map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                      {duplicateWarnings.length > 5 && (
                        <li>...and {duplicateWarnings.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {recurringPreview.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No occurrences fall within this period's date range.
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recurringPreview.slice(0, 10).map((preview, i) => {
                      const isDuplicate = forecasts.some(
                        (f) => f.description === preview.description && f.date === preview.date,
                      );
                      return (
                        <TableRow key={i} className={isDuplicate ? 'opacity-50' : ''}>
                          <TableCell>{formatDate(preview.date)}</TableCell>
                          <TableCell>
                            {preview.description}
                            {isDuplicate && (
                              <span className="ml-2 text-xs text-muted-foreground">(exists)</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={preview.type === 'income' ? 'success' : 'destructive'}>
                              {preview.type === 'income' ? 'Income' : 'Expense'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            <span
                              className={
                                preview.type === 'income' ? 'text-green-600' : 'text-red-600'
                              }
                            >
                              {preview.type === 'income' ? '+' : '-'}
                              {formatCents(preview.amountCents)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {recurringPreview.length > 10 && (
                  <p className="text-sm text-muted-foreground">
                    ...and {recurringPreview.length - 10} more
                  </p>
                )}
              </>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleImportRecurring}
                disabled={
                  recurringPreview.length === 0 ||
                  recurringPreview.length === duplicateWarnings.length
                }
              >
                Import {recurringPreview.length - duplicateWarnings.length} Forecast
                {recurringPreview.length - duplicateWarnings.length !== 1 ? 's' : ''}
              </Button>
              <Button variant="outline" onClick={() => setShowImportPreview(false)}>
                Cancel
              </Button>
            </div>
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
              <h3 className="font-medium">Delete Period</h3>
              <p className="text-sm text-muted-foreground">
                Permanently delete this period and all associated data.
              </p>
            </div>
            <div className="flex gap-2">
              {confirmingDelete && (
                <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
              )}
              <Button variant="destructive" onClick={handleDelete}>
                {confirmingDelete ? 'Confirm Delete' : 'Delete Period'}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
