import { useState, useMemo, useCallback } from 'react';
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
import { Plus, ArrowLeft, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
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
  const { activeScenario, isLoading: scenariosLoading } = useScenarios();
  const { rules, isLoading: forecastsLoading, addRule, updateRule, deleteRule } = useForecasts(activeScenarioId);
  const { categories, activeCategories, isLoading: categoriesLoading } = useCategories();
  const { savingsGoals, isLoading: savingsLoading } = useSavingsGoals();

  // Combined loading state from all data hooks
  const isLoading = scenariosLoading || forecastsLoading || categoriesLoading || savingsLoading;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ForecastRule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Initialize category filter from URL param if present
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>(() => {
    const categoryParam = searchParams.get('category');
    return categoryParam ?? 'all';
  });

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabValue | null>(null);

  const openEditDialog = useCallback((rule: ForecastRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingRule(null);
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (deletingId === id) {
      deleteRule(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
    }
  }, [deletingId, deleteRule]);

  const getCategoryName = useCallback(
    (id: string | null) => (id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-'),
    [categories],
  );
  const getSavingsGoalName = useCallback(
    (id: string | null) => (id ? (savingsGoals.find((g) => g.id === id)?.name ?? 'Unknown') : '-'),
    [savingsGoals],
  );

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
          <button
            type="button"
            onClick={() => openEditDialog(row.original)}
            className="cursor-pointer font-medium hover:underline text-left"
          >
            {row.getValue('description')}
          </button>
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
        cell: ({ row }) => {
          const rule = row.original;
          const isDeleting = deletingId === rule.id;
          return (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEditDialog(rule)} aria-label="Edit rule">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant={isDeleting ? 'destructive' : 'ghost'}
                size="sm"
                onClick={() => handleDelete(rule.id)}
                onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                aria-label={isDeleting ? 'Confirm delete' : 'Delete rule'}
              >
                {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        },
      },
    ],
    [deletingId, openEditDialog, handleDelete],
  );

  const expenseColumns: ColumnDef<ForecastRule>[] = useMemo(
    () => [
      {
        accessorKey: 'description',
        header: ({ column }) => <SortableHeader column={column}>Description</SortableHeader>,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => openEditDialog(row.original)}
            className="cursor-pointer font-medium hover:underline text-left"
          >
            {row.getValue('description')}
          </button>
        ),
      },
      {
        accessorKey: 'categoryId',
        header: 'Category',
        cell: ({ row }) => {
          const categoryId = row.getValue('categoryId') as string | null;
          const categoryName = getCategoryName(categoryId);
          if (!categoryId) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <Link
              to={`/categories/${categoryId}`}
              className="hover:underline"
            >
              {categoryName}
            </Link>
          );
        },
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
        cell: ({ row }) => {
          const rule = row.original;
          const isDeleting = deletingId === rule.id;
          return (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEditDialog(rule)} aria-label="Edit rule">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant={isDeleting ? 'destructive' : 'ghost'}
                size="sm"
                onClick={() => handleDelete(rule.id)}
                onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                aria-label={isDeleting ? 'Confirm delete' : 'Delete rule'}
              >
                {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        },
      },
    ],
    [deletingId, openEditDialog, handleDelete, getCategoryName],
  );

  const savingsColumns: ColumnDef<ForecastRule>[] = useMemo(
    () => [
      {
        accessorKey: 'description',
        header: ({ column }) => <SortableHeader column={column}>Description</SortableHeader>,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => openEditDialog(row.original)}
            className="cursor-pointer font-medium hover:underline text-left"
          >
            {row.getValue('description')}
          </button>
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
        cell: ({ row }) => {
          const rule = row.original;
          const isDeleting = deletingId === rule.id;
          return (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEditDialog(rule)} aria-label="Edit rule">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant={isDeleting ? 'destructive' : 'ghost'}
                size="sm"
                onClick={() => handleDelete(rule.id)}
                onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                aria-label={isDeleting ? 'Confirm delete' : 'Delete rule'}
              >
                {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        },
      },
    ],
    [deletingId, openEditDialog, handleDelete, getSavingsGoalName],
  );

  // Determine the effective tab (use state if set, otherwise default based on which has rules)
  const defaultTab: TabValue = incomeRules.length > 0 ? 'income' : expenseRules.length > 0 ? 'expenses' : 'savings';
  const effectiveTab = activeTab ?? defaultTab;

  // Show loading spinner while data is being fetched
  if (isLoading) {
    return (
      <div className="page-shell">
        <PageLoading />
      </div>
    );
  }

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="page-shell">
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link to="/forecasts">
              <ArrowLeft className="h-4 w-4" />
              Back to Forecasts
            </Link>
          </Button>
        </div>
        <div className="empty-state">
          <p className="empty-state-text">Select a scenario to manage recurring forecasts.</p>
          <Button asChild className="empty-state-action">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link to="/forecasts">
            <ArrowLeft className="h-4 w-4" />
            Back to Forecasts
          </Link>
        </Button>
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <RefreshCw className="h-5 w-5 text-slate-500" />
            </div>
            Recurring Forecasts
          </h1>
          <p className="page-description">
            Recurring income, expense, and savings patterns for {activeScenario.name}.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Recurring
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="mt-8 empty-state">
          <p className="empty-state-text">No recurring forecasts yet.</p>
          <Button className="empty-state-action" onClick={() => setDialogOpen(true)}>
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
                      : 'hover:text-foreground',
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
              <div className="empty-state">
                <p className="empty-state-text">No recurring income yet.</p>
                <Button className="empty-state-action" onClick={() => setDialogOpen(true)}>
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
              <div className="empty-state">
                <p className="empty-state-text">No recurring expenses yet.</p>
                <Button className="empty-state-action" onClick={() => setDialogOpen(true)}>
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
              <div className="empty-state">
                <p className="empty-state-text">No recurring savings yet.</p>
                <Button className="empty-state-action" onClick={() => setDialogOpen(true)}>
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
        onOpenChange={handleDialogClose}
        scenarioId={activeScenarioId}
        rule={editingRule}
        addRule={addRule}
        updateRule={updateRule}
      />
    </div>
  );
}
