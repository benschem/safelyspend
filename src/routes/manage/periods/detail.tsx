import { useState } from 'react';
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
import { ArrowLeft, Check } from 'lucide-react';
import { usePeriods } from '@/hooks/use-periods';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { useOpeningBalances } from '@/hooks/use-opening-balances';
import { useBudgetLines } from '@/hooks/use-budget-lines';
import { formatCents, parseCentsFromInput } from '@/lib/utils';

export function PeriodDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { periods, activePeriodId, setActivePeriodId, updatePeriod, deletePeriod } = usePeriods();
  const { activeAccounts } = useAccounts();
  const { activeCategories } = useCategories();
  const { getBalanceForAccount, setBalanceForAccount } = useOpeningBalances(id ?? null);
  const { getBudgetForCategory, setBudgetForCategory } = useBudgetLines(id ?? null);

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
