import { useState, useMemo, useRef } from 'react';
import { Link, useOutletContext } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Pencil, Check, X } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';
import { formatCents, parseCentsFromInput } from '@/lib/utils';
import type { Cadence, BudgetRule } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

interface BudgetRow {
  id: string;
  name: string;
  rule: BudgetRule | null;
  budgeted: number;
  actual: number;
  remaining: number;
}

const CADENCE_LABELS: Record<Cadence, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export function BudgetPage() {
  const { activeScenarioId, startDate, endDate } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { activeCategories } = useCategories();
  const { getBudgetForCategory, getRuleForCategory, setBudgetForCategory, deleteBudgetRule } =
    useBudgetRules(activeScenarioId, startDate, endDate);
  const { expenseTransactions } = useTransactions(startDate, endDate);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCadence, setEditCadence] = useState<Cadence>('monthly');

  // Refs to access current values in memoized column cell functions
  const editAmountRef = useRef(editAmount);
  const editCadenceRef = useRef(editCadence);
  editAmountRef.current = editAmount;
  editCadenceRef.current = editCadence;

  // Calculate actual spending per category
  const spendingByCategory = useMemo(() => {
    const spending: Record<string, number> = {};
    for (const tx of expenseTransactions) {
      if (tx.categoryId) {
        spending[tx.categoryId] = (spending[tx.categoryId] ?? 0) + tx.amountCents;
      }
    }
    return spending;
  }, [expenseTransactions]);

  // Build rows for all active categories
  const categoryRows: BudgetRow[] = useMemo(() => {
    return activeCategories.map((category) => {
      const rule = getRuleForCategory(category.id);
      const budgeted = getBudgetForCategory(category.id);
      const actual = spendingByCategory[category.id] ?? 0;
      const remaining = budgeted - actual;
      return {
        id: category.id,
        name: category.name,
        rule,
        budgeted,
        actual,
        remaining,
      };
    });
  }, [activeCategories, getBudgetForCategory, getRuleForCategory, spendingByCategory]);

  // Calculate totals
  const totals = useMemo(() => {
    return categoryRows.reduce(
      (acc, row) => ({
        budgeted: acc.budgeted + row.budgeted,
        actual: acc.actual + row.actual,
        remaining: acc.remaining + row.remaining,
      }),
      { budgeted: 0, actual: 0, remaining: 0 },
    );
  }, [categoryRows]);

  const startEditing = (categoryId: string) => {
    const rule = getRuleForCategory(categoryId);
    setEditAmount(rule ? (rule.amountCents / 100).toFixed(2) : '');
    setEditCadence(rule?.cadence ?? 'monthly');
    setEditingId(categoryId);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditAmount('');
    setEditCadence('monthly');
  };

  const saveEditing = (categoryId: string) => {
    const amountCents = parseCentsFromInput(editAmountRef.current);
    if (amountCents > 0) {
      setBudgetForCategory(categoryId, amountCents, editCadenceRef.current);
    } else {
      // If amount is 0 or empty, delete the rule
      const rule = getRuleForCategory(categoryId);
      if (rule) {
        deleteBudgetRule(rule.id);
      }
    }
    cancelEditing();
  };

  const columns: ColumnDef<BudgetRow>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column}>Category</SortableHeader>,
        cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span>,
      },
      {
        id: 'budget',
        header: 'Budget',
        cell: ({ row }) => {
          const budgetRow = row.original;
          const isEditing = editingId === budgetRow.id;

          if (isEditing) {
            return (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editAmountRef.current}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-24"
                  placeholder="0.00"
                />
                <Select
                  value={editCadenceRef.current}
                  onValueChange={(v) => setEditCadence(v as Cadence)}
                >
                  <SelectTrigger className="w-32">
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
            );
          }

          if (budgetRow.rule) {
            return (
              <span className="text-muted-foreground">
                {formatCents(budgetRow.rule.amountCents)} / {CADENCE_LABELS[budgetRow.rule.cadence]}
              </span>
            );
          }

          return <span className="text-muted-foreground">-</span>;
        },
      },
      {
        accessorKey: 'budgeted',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Budgeted (Period)
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            {row.getValue('budgeted') as number > 0 ? formatCents(row.getValue('budgeted')) : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'actual',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Actual
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            {row.getValue('actual') as number > 0 ? formatCents(row.getValue('actual')) : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'remaining',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Remaining
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const budgetRow = row.original;
          // Don't show remaining if no budget is set
          if (budgetRow.budgeted === 0) {
            return <div className="text-right">-</div>;
          }
          return (
            <div className="text-right font-mono">
              <span className={budgetRow.remaining >= 0 ? 'text-green-600' : 'text-red-600'}>
                {budgetRow.remaining >= 0 ? '' : '-'}
                {formatCents(Math.abs(budgetRow.remaining))}
                {budgetRow.remaining < 0 && ' over'}
              </span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const budgetRow = row.original;
          const isEditing = editingId === budgetRow.id;

          if (isEditing) {
            return (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => saveEditing(budgetRow.id)}
                  className="h-8 w-8"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={cancelEditing}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          }

          if (budgetRow.rule) {
            return (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => startEditing(budgetRow.id)}
                  className="h-8 w-8"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            );
          }

          return (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => startEditing(budgetRow.id)}
              >
                Set budget
              </Button>
            </div>
          );
        },
      },
    ],
    [editingId],
  );

  const footerRow = (
    <TableRow>
      <TableCell className="font-semibold">Total</TableCell>
      <TableCell></TableCell>
      <TableCell className="text-right font-mono font-semibold">
        {formatCents(totals.budgeted)}
      </TableCell>
      <TableCell className="text-right font-mono font-semibold">
        {formatCents(totals.actual)}
      </TableCell>
      <TableCell className="text-right font-mono font-semibold">
        <span className={totals.remaining >= 0 ? 'text-green-600' : 'text-red-600'}>
          {totals.remaining >= 0 ? '' : '-'}
          {formatCents(Math.abs(totals.remaining))}
          {totals.remaining < 0 && ' over'}
        </span>
      </TableCell>
      <TableCell></TableCell>
    </TableRow>
  );

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No scenario selected</h2>
        <p className="text-muted-foreground">Select a scenario to view budget.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-muted-foreground">
            Spending limits per category for {activeScenario.name}.
          </p>
        </div>
      </div>

      {activeCategories.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No categories found.</p>
          <Button asChild className="mt-4">
            <Link to="/categories">Add your first category</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          <DataTable
            columns={columns}
            data={categoryRows}
            searchKey="name"
            searchPlaceholder="Search categories..."
            showPagination={false}
            footer={footerRow}
          />
        </div>
      )}
    </div>
  );
}
