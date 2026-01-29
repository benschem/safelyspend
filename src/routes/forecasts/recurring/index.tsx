import { useState, useMemo } from 'react';
import { useOutletContext, Link, useSearchParams } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus, ArrowLeft, Pencil, RefreshCw } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { ForecastRuleDialog } from '@/components/dialogs/forecast-rule-dialog';
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

type CategoryFilter = 'all' | string;

type TabValue = 'income' | 'expenses' | 'savings';

export function RecurringIndexPage() {
  const [searchParams] = useSearchParams();
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { rules, addRule, updateRule } = useForecasts(activeScenarioId);
  const { categories, activeCategories } = useCategories();
  const { savingsGoals } = useSavingsGoals();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Initialize category filter from URL param if present
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>(() => {
    const categoryParam = searchParams.get('category');
    return categoryParam ?? 'all';
  });

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabValue | null>(null);

  const getCategoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-';
  const getSavingsGoalName = (id: string | null) =>
    id ? (savingsGoals.find((g) => g.id === id)?.name ?? 'Unknown') : '-';

  // Filter rules by category if specified (only affects expense rules which have categories)
  const filteredRules = useMemo(() => {
    if (filterCategory === 'all') return rules;
    return rules.filter((r) => r.categoryId === filterCategory || r.type !== 'expense');
  }, [rules, filterCategory]);

  const incomeRules = useMemo(() => filteredRules.filter((r) => r.type === 'income'), [filteredRules]);
  const expenseRules = useMemo(() => {
    const expenses = filteredRules.filter((r) => r.type === 'expense');
    // If filtering by category, only show matching expenses
    if (filterCategory !== 'all') {
      return expenses.filter((r) => r.categoryId === filterCategory);
    }
    return expenses;
  }, [filteredRules, filterCategory]);
  const savingsRules = useMemo(() => filteredRules.filter((r) => r.type === 'savings'), [filteredRules]);

  const incomeColumns: ColumnDef<ForecastRule>[] = useMemo(
    () => [
      {
        accessorKey: 'description',
        header: ({ column }) => <SortableHeader column={column}>Description</SortableHeader>,
        cell: ({ row }) => (
          <Link to={`/forecasts/recurring/${row.original.id}`} className="font-medium hover:underline">
            {row.getValue('description')}
          </Link>
        ),
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
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" asChild title="Edit">
              <Link to={`/forecasts/recurring/${row.original.id}`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          </div>
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
        cell: ({ row }) => (
          <Link to={`/forecasts/recurring/${row.original.id}`} className="font-medium hover:underline">
            {row.getValue('description')}
          </Link>
        ),
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
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" asChild title="Edit">
              <Link to={`/forecasts/recurring/${row.original.id}`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          </div>
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
        cell: ({ row }) => (
          <Link to={`/forecasts/recurring/${row.original.id}`} className="font-medium hover:underline">
            {row.getValue('description')}
          </Link>
        ),
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
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" asChild title="Edit">
              <Link to={`/forecasts/recurring/${row.original.id}`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [savingsGoals],
  );

  // Determine the effective tab (use state if set, otherwise default based on which has rules)
  const defaultTab: TabValue = incomeRules.length > 0 ? 'income' : expenseRules.length > 0 ? 'expenses' : 'savings';
  const effectiveTab = activeTab ?? defaultTab;

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No scenario selected</h2>
        <p className="text-muted-foreground">Select a scenario to manage recurring forecasts.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link to="/forecasts">
            <ArrowLeft className="h-4 w-4" />
            Back to Forecasts
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500/10">
              <RefreshCw className="h-5 w-5 text-slate-500" />
            </div>
            Recurring Forecasts
          </h1>
          <p className="mt-1 text-muted-foreground">
            Recurring income, expense, and savings patterns for {activeScenario.name}.
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Recurring
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No recurring forecasts yet.</p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>
            Create your first recurring forecast
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Segmented control */}
            <div className="inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground">
              {[
                { value: 'income' as TabValue, label: 'Income', count: incomeRules.length },
                { value: 'expenses' as TabValue, label: 'Expenses', count: expenseRules.length },
                { value: 'savings' as TabValue, label: 'Savings', count: savingsRules.length },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    'inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all',
                    effectiveTab === tab.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'hover:text-foreground'
                  )}
                >
                  {tab.label} {tab.count > 0 && `(${tab.count})`}
                </button>
              ))}
            </div>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {activeCategories
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content sections */}
          {effectiveTab === 'income' && (
            incomeRules.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground">No recurring income yet.</p>
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  Add recurring income
                </Button>
              </div>
            ) : (
              <DataTable
                columns={incomeColumns}
                data={incomeRules}
                searchKey="description"
                searchPlaceholder="Search income..."
                showPagination={false}
              />
            )
          )}

          {effectiveTab === 'expenses' && (
            expenseRules.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground">No recurring expenses yet.</p>
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  Add recurring expense
                </Button>
              </div>
            ) : (
              <DataTable
                columns={expenseColumns}
                data={expenseRules}
                searchKey="description"
                searchPlaceholder="Search expenses..."
                showPagination={false}
              />
            )
          )}

          {effectiveTab === 'savings' && (
            savingsRules.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground">No recurring savings yet.</p>
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  Add recurring savings
                </Button>
              </div>
            ) : (
              <DataTable
                columns={savingsColumns}
                data={savingsRules}
                searchKey="description"
                searchPlaceholder="Search savings..."
                showPagination={false}
              />
            )
          )}
        </div>
      )}

      <ForecastRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        scenarioId={activeScenarioId}
        rule={null}
        addRule={addRule}
        updateRule={updateRule}
      />
    </div>
  );
}
