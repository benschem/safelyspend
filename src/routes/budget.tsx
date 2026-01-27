import { useState, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, Check, X } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';
import { formatCents, parseCentsFromInput } from '@/lib/utils';
import type { Cadence } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
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
  const categoryRows = useMemo(() => {
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
    const amountCents = parseCentsFromInput(editAmount);
    if (amountCents > 0) {
      setBudgetForCategory(categoryId, amountCents, editCadence);
    } else {
      // If amount is 0 or empty, delete the rule
      const rule = getRuleForCategory(categoryId);
      if (rule) {
        deleteBudgetRule(rule.id);
      }
    }
    cancelEditing();
  };

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
          <h1 className="text-2xl font-bold">Budget</h1>
          <p className="text-muted-foreground">
            Spending limits per category for {activeScenario.name}.
          </p>
        </div>
      </div>

      {activeCategories.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No categories found.</p>
          <Button asChild className="mt-4">
            <Link to="/categories/new">Add your first category</Link>
          </Button>
        </div>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead className="text-right">Budgeted (Period)</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categoryRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  {editingId === row.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-24"
                        placeholder="0.00"
                      />
                      <Select
                        value={editCadence}
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
                  ) : row.rule ? (
                    <span className="text-muted-foreground">
                      {formatCents(row.rule.amountCents)} / {CADENCE_LABELS[row.rule.cadence]}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.budgeted > 0 ? formatCents(row.budgeted) : '-'}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.actual > 0 ? formatCents(row.actual) : '-'}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.budgeted > 0 || row.actual > 0 ? (
                    <span className={row.remaining >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {row.remaining >= 0 ? '' : '-'}
                      {formatCents(Math.abs(row.remaining))}
                      {row.remaining < 0 && ' over'}
                    </span>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {editingId === row.id ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => saveEditing(row.id)}
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
                  ) : row.rule ? (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditing(row.id)}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEditing(row.id)}
                      >
                        Set budget
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
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
          </TableFooter>
        </Table>
      )}
    </div>
  );
}
