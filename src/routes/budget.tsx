import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useScenarios } from '@/hooks/use-scenarios';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';
import { formatCents } from '@/lib/utils';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

export function BudgetPage() {
  const { activeScenarioId, startDate, endDate } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { activeCategories } = useCategories();
  const { getBudgetForCategory } = useBudgetRules(activeScenarioId, startDate, endDate);
  const { expenseTransactions } = useTransactions(startDate, endDate);

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
      const budgeted = getBudgetForCategory(category.id);
      const actual = spendingByCategory[category.id] ?? 0;
      const remaining = budgeted - actual;
      return {
        id: category.id,
        name: category.name,
        budgeted,
        actual,
        remaining,
      };
    });
  }, [activeCategories, getBudgetForCategory, spendingByCategory]);

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
        <Button variant="outline" asChild>
          <Link to={`/manage/scenarios/${activeScenarioId}`}>Edit Budget Rules</Link>
        </Button>
      </div>

      {activeCategories.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No categories found.</p>
          <Button asChild className="mt-4">
            <Link to="/manage/categories/new">Add your first category</Link>
          </Button>
        </div>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Budgeted</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categoryRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
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
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">Total</TableCell>
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
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );
}
