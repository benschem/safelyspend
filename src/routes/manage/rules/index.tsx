import { useMemo } from 'react';
import { useOutletContext, Link } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { formatCents } from '@/lib/utils';
import type { ForecastRule } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

const CADENCE_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export function RulesIndexPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { rules } = useForecasts(activeScenarioId);
  const { categories } = useCategories();
  const { savingsGoals } = useSavingsGoals();

  const getCategoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-';
  const getSavingsGoalName = (id: string | null) =>
    id ? (savingsGoals.find((g) => g.id === id)?.name ?? 'Unknown') : '-';

  const incomeRules = useMemo(() => rules.filter((r) => r.type === 'income'), [rules]);
  const expenseRules = useMemo(() => rules.filter((r) => r.type === 'expense'), [rules]);
  const savingsRules = useMemo(() => rules.filter((r) => r.type === 'savings'), [rules]);

  const incomeColumns: ColumnDef<ForecastRule>[] = useMemo(
    () => [
      {
        accessorKey: 'description',
        header: ({ column }) => <SortableHeader column={column}>Description</SortableHeader>,
        cell: ({ row }) => <span className="font-medium">{row.getValue('description')}</span>,
      },
      {
        accessorKey: 'cadence',
        header: 'Cadence',
        cell: ({ row }) => (
          <Badge variant="outline">{CADENCE_LABELS[row.getValue('cadence') as string]}</Badge>
        ),
      },
      {
        accessorKey: 'amountCents',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Amount
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono text-green-600">
            +{formatCents(row.getValue('amountCents'))}
          </div>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/manage/rules/${row.original.id}`}>Edit</Link>
          </Button>
        ),
      },
    ],
    [],
  );

  const expenseColumns: ColumnDef<ForecastRule>[] = useMemo(
    () => [
      {
        accessorKey: 'description',
        header: ({ column }) => <SortableHeader column={column}>Description</SortableHeader>,
        cell: ({ row }) => <span className="font-medium">{row.getValue('description')}</span>,
      },
      {
        accessorKey: 'categoryId',
        header: 'Category',
        cell: ({ row }) => getCategoryName(row.getValue('categoryId')),
      },
      {
        accessorKey: 'cadence',
        header: 'Cadence',
        cell: ({ row }) => (
          <Badge variant="outline">{CADENCE_LABELS[row.getValue('cadence') as string]}</Badge>
        ),
      },
      {
        accessorKey: 'amountCents',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Amount
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono text-red-600">
            -{formatCents(row.getValue('amountCents'))}
          </div>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/manage/rules/${row.original.id}`}>Edit</Link>
          </Button>
        ),
      },
    ],
    [categories],
  );

  const savingsColumns: ColumnDef<ForecastRule>[] = useMemo(
    () => [
      {
        accessorKey: 'description',
        header: ({ column }) => <SortableHeader column={column}>Description</SortableHeader>,
        cell: ({ row }) => <span className="font-medium">{row.getValue('description')}</span>,
      },
      {
        accessorKey: 'savingsGoalId',
        header: 'Savings Goal',
        cell: ({ row }) => getSavingsGoalName(row.getValue('savingsGoalId')),
      },
      {
        accessorKey: 'cadence',
        header: 'Cadence',
        cell: ({ row }) => (
          <Badge variant="outline">{CADENCE_LABELS[row.getValue('cadence') as string]}</Badge>
        ),
      },
      {
        accessorKey: 'amountCents',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Amount
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono text-blue-600">
            -{formatCents(row.getValue('amountCents'))}
          </div>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/manage/rules/${row.original.id}`}>Edit</Link>
          </Button>
        ),
      },
    ],
    [savingsGoals],
  );

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No scenario selected</h2>
        <p className="text-muted-foreground">Select a scenario to manage forecast rules.</p>
      </div>
    );
  }

  // Determine the default tab based on which has rules
  const defaultTab = incomeRules.length > 0 ? 'income' : expenseRules.length > 0 ? 'expenses' : 'savings';

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recurring Forecasts</h1>
          <p className="text-muted-foreground">
            Recurring income, expense, and savings patterns for {activeScenario.name}.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link to="/manage/rules/new">
            <Plus className="h-4 w-4" />
            Add Rule
          </Link>
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No forecast rules yet.</p>
          <Button asChild className="mt-4">
            <Link to="/manage/rules/new">Create your first rule</Link>
          </Button>
        </div>
      ) : (
        <Tabs defaultValue={defaultTab} className="mt-6 w-full">
          <TabsList className="flex w-full">
            <TabsTrigger value="income" className="flex-1">
              Income {incomeRules.length > 0 && `(${incomeRules.length})`}
            </TabsTrigger>
            <TabsTrigger value="expenses" className="flex-1">
              Expenses {expenseRules.length > 0 && `(${expenseRules.length})`}
            </TabsTrigger>
            <TabsTrigger value="savings" className="flex-1">
              Savings {savingsRules.length > 0 && `(${savingsRules.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="income">
            {incomeRules.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground">No income rules yet.</p>
                <Button asChild className="mt-4">
                  <Link to="/manage/rules/new">Add an income rule</Link>
                </Button>
              </div>
            ) : (
              <DataTable
                columns={incomeColumns}
                data={incomeRules}
                searchKey="description"
                searchPlaceholder="Search income rules..."
                showPagination={false}
              />
            )}
          </TabsContent>

          <TabsContent value="expenses">
            {expenseRules.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground">No expense rules yet.</p>
                <Button asChild className="mt-4">
                  <Link to="/manage/rules/new">Add an expense rule</Link>
                </Button>
              </div>
            ) : (
              <DataTable
                columns={expenseColumns}
                data={expenseRules}
                searchKey="description"
                searchPlaceholder="Search expense rules..."
                showPagination={false}
              />
            )}
          </TabsContent>

          <TabsContent value="savings">
            {savingsRules.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground">No savings rules yet.</p>
                <Button asChild className="mt-4">
                  <Link to="/manage/rules/new">Add a savings rule</Link>
                </Button>
              </div>
            ) : (
              <DataTable
                columns={savingsColumns}
                data={savingsRules}
                searchKey="description"
                searchPlaceholder="Search savings rules..."
                showPagination={false}
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
