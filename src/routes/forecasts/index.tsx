import { useState, useMemo, useCallback } from 'react';
import { useOutletContext, Link, useSearchParams } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus, Repeat, Settings2, Pencil, Trash2, Telescope, RotateCcw, TrendingUp, TrendingDown, PiggyBank, ChevronUp, ChevronDown } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useScenarios } from '@/hooks/use-scenarios';
import { ScenarioSelector } from '@/components/scenario-selector';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useLocalStorage } from '@/hooks/use-local-storage';

type FilterType = 'all' | 'income' | 'expense' | 'savings';
type CategoryFilter = 'all' | string;
import { DateRangeFilter } from '@/components/date-range-filter';
import { ForecastEventDialog } from '@/components/dialogs/forecast-event-dialog';
import { ForecastRuleDialog } from '@/components/dialogs/forecast-rule-dialog';
import { DeleteForecastDialog } from '@/components/dialogs/delete-forecast-dialog';
import { BudgetPromptDialog } from '@/components/dialogs/budget-prompt-dialog';
import { formatCents, formatDate, today as getToday, toMonthlyCents, type CadenceType } from '@/lib/utils';
import type { ExpandedForecast, ForecastEvent, ForecastRule } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
}

// Default: from today onwards, no end date
const getDefaultStartDate = () => getToday();
const getDefaultEndDate = () => '';

export function ForecastIndexPage() {
  const [searchParams] = useSearchParams();
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario, isLoading: scenariosLoading } = useScenarios();
  const { categories, activeCategories, isLoading: categoriesLoading } = useCategories();
  const { getRuleForCategory, setBudgetForCategory } = useBudgetRules(activeScenarioId);

  // Budget prompt preference
  const [skipBudgetPrompt, setSkipBudgetPrompt] = useLocalStorage('budget:skipBudgetPrompt', false);

  // Date filter - defaults to today onwards
  const [filterStartDate, setFilterStartDate] = useState(getDefaultStartDate);
  const [filterEndDate, setFilterEndDate] = useState(getDefaultEndDate);

  // Has non-default filter
  const hasDateFilter = filterStartDate !== getDefaultStartDate() || filterEndDate !== getDefaultEndDate();

  const resetFilters = useCallback(() => {
    setFilterStartDate(getDefaultStartDate());
    setFilterEndDate(getDefaultEndDate());
  }, []);

  // Use wide defaults for unset dates (partial filter support)
  const defaultStart = '2020-01-01';
  const defaultEnd = '2099-12-31';
  const queryStartDate = filterStartDate || defaultStart;
  const queryEndDate = filterEndDate || defaultEnd;

  const { expandedForecasts, rules, events, isLoading: forecastsLoading, addRule, updateRule, deleteRule, excludeOccurrence, addEvent, updateEvent, deleteEvent } = useForecasts(activeScenarioId, queryStartDate, queryEndDate);

  // Combined loading state from all data hooks
  const isLoading = scenariosLoading || categoriesLoading || forecastsLoading;

  // Check if any forecasts exist at all (rules or events)
  const hasAnyForecasts = rules.length > 0 || events.length > 0;

  const [filterType, setFilterType] = useState<FilterType>('all');
  // Initialize category filter from URL param if present
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>(() => {
    const categoryParam = searchParams.get('category');
    return categoryParam ?? 'all';
  });

  // Dialog state
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ForecastEvent | null>(null);
  const [editingRule, setEditingRule] = useState<ForecastRule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingForecast, setDeletingForecast] = useState<ExpandedForecast | null>(null);

  // Budget prompt dialog state
  const [budgetPromptOpen, setBudgetPromptOpen] = useState(false);
  const [createdRule, setCreatedRule] = useState<ForecastRule | null>(null);

  const getCategoryName = useCallback(
    (id: string | null) => (id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-'),
    [categories],
  );

  const filteredForecasts = useMemo(
    () => expandedForecasts.filter((f) => {
      if (filterType !== 'all' && f.type !== filterType) return false;
      if (filterCategory !== 'all' && f.categoryId !== filterCategory) return false;
      return true;
    }),
    [expandedForecasts, filterType, filterCategory],
  );

  const openAddEventDialog = useCallback(() => {
    setEditingEvent(null);
    setEventDialogOpen(true);
  }, []);

  const openAddRuleDialog = useCallback(() => {
    setEditingRule(null);
    setRuleDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((forecast: ExpandedForecast) => {
    if (forecast.sourceType === 'rule') {
      const rule = rules.find(r => r.id === forecast.sourceId);
      if (rule) {
        setEditingRule(rule);
        setRuleDialogOpen(true);
      }
    } else {
      const event = events.find(e => e.id === forecast.sourceId);
      if (event) {
        setEditingEvent(event);
        setEventDialogOpen(true);
      }
    }
  }, [rules, events]);

  const handleEventDialogClose = useCallback((open: boolean) => {
    setEventDialogOpen(open);
    if (!open) {
      setEditingEvent(null);
    }
  }, []);

  const handleRuleDialogClose = useCallback((open: boolean) => {
    setRuleDialogOpen(open);
    if (!open) {
      setEditingRule(null);
    }
  }, []);

  const openDeleteDialog = useCallback((forecast: ExpandedForecast) => {
    setDeletingForecast(forecast);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteOccurrence = useCallback(() => {
    if (!deletingForecast) return;
    excludeOccurrence(deletingForecast.sourceId, deletingForecast.date);
    setDeleteDialogOpen(false);
    setDeletingForecast(null);
  }, [deletingForecast, excludeOccurrence]);

  const handleDeleteAll = useCallback(() => {
    if (!deletingForecast) return;
    if (deletingForecast.sourceType === 'rule') {
      deleteRule(deletingForecast.sourceId);
    } else {
      deleteEvent(deletingForecast.sourceId);
    }
    setDeleteDialogOpen(false);
    setDeletingForecast(null);
  }, [deletingForecast, deleteRule, deleteEvent]);

  // Handle when a new forecast rule is created
  const handleRuleCreated = useCallback((rule: ForecastRule) => {
    // Only prompt for expenses with a category
    if (rule.type === 'expense' && rule.categoryId && !skipBudgetPrompt) {
      setCreatedRule(rule);
      setBudgetPromptOpen(true);
    }
  }, [skipBudgetPrompt]);

  // Get category name for the created rule
  const createdRuleCategoryName = useMemo(() => {
    if (!createdRule?.categoryId) return '';
    return categories.find((c) => c.id === createdRule.categoryId)?.name ?? 'Unknown';
  }, [createdRule, categories]);

  // Get existing budget for the category
  const existingBudgetForCreatedRule = useMemo(() => {
    if (!createdRule?.categoryId) return null;
    return getRuleForCategory(createdRule.categoryId);
  }, [createdRule, getRuleForCategory]);

  // Handle adding to existing budget
  const handleAddToBudget = useCallback(async (dontAskAgain: boolean) => {
    if (!createdRule?.categoryId) return;

    const existingBudget = getRuleForCategory(createdRule.categoryId);
    const newMonthly = toMonthlyCents(createdRule.amountCents, createdRule.cadence as CadenceType);
    const existingMonthly = existingBudget
      ? toMonthlyCents(existingBudget.amountCents, existingBudget.cadence as CadenceType)
      : 0;

    // Add to existing (or create new with this amount)
    await setBudgetForCategory(createdRule.categoryId, existingMonthly + newMonthly, 'monthly');

    if (dontAskAgain) setSkipBudgetPrompt(true);
    setCreatedRule(null);
  }, [createdRule, getRuleForCategory, setBudgetForCategory, setSkipBudgetPrompt]);

  // Handle replacing budget
  const handleReplaceBudget = useCallback(async (dontAskAgain: boolean) => {
    if (!createdRule?.categoryId) return;

    const newMonthly = toMonthlyCents(createdRule.amountCents, createdRule.cadence as CadenceType);
    await setBudgetForCategory(createdRule.categoryId, newMonthly, 'monthly');

    if (dontAskAgain) setSkipBudgetPrompt(true);
    setCreatedRule(null);
  }, [createdRule, setBudgetForCategory, setSkipBudgetPrompt]);

  // Handle skipping budget prompt
  const handleSkipBudget = useCallback((dontAskAgain: boolean) => {
    if (dontAskAgain) setSkipBudgetPrompt(true);
    setCreatedRule(null);
  }, [setSkipBudgetPrompt]);

  const columns: ColumnDef<ExpandedForecast>[] = useMemo(
    () => [
      {
        accessorKey: 'date',
        header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>,
        cell: ({ row }) => formatDate(row.getValue('date')),
        sortingFn: 'datetime',
      },
      {
        accessorKey: 'description',
        header: ({ column }) => <SortableHeader column={column}>Description</SortableHeader>,
        cell: ({ row }) => {
          const forecast = row.original;
          return (
            <button
              type="button"
              onClick={() => openEditDialog(forecast)}
              className="cursor-pointer text-left font-medium hover:underline"
            >
              {row.getValue('description')}
            </button>
          );
        },
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => {
          const type = row.getValue('type') as string;
          if (type === 'income') {
            return (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <TrendingUp className="h-3 w-3" />
                Income
              </div>
            );
          }
          if (type === 'savings') {
            return (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <PiggyBank className="h-3 w-3" />
                Savings
              </div>
            );
          }
          return (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <TrendingDown className="h-3 w-3" />
              Expense
            </div>
          );
        },
      },
      {
        accessorKey: 'sourceType',
        header: 'Source',
        cell: ({ row }) => {
          const isRecurring = row.getValue('sourceType') === 'rule';
          return (
            <Badge variant="outline" className="gap-1">
              {isRecurring && <Repeat className="h-3 w-3" />}
              {isRecurring ? 'Recurring' : 'One-time'}
            </Badge>
          );
        },
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
        accessorKey: 'amountCents',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Amount
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const type = row.original.type;
          const amount = row.getValue('amountCents') as number;

          // Savings: show absolute value with chevron indicator
          if (type === 'savings') {
            const isWithdrawal = amount < 0;
            return (
              <div className="flex items-center justify-end gap-1 font-mono text-blue-600">
                {isWithdrawal ? (
                  <ChevronDown className="h-4 w-4 text-red-500" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-green-500" />
                )}
                {formatCents(Math.abs(amount))}
              </div>
            );
          }

          // Other types: income positive, expense negative
          const colorClass = type === 'income' ? 'text-green-600' : 'text-red-600';
          return (
            <div className="text-right font-mono">
              <span className={colorClass}>
                {type === 'income' ? '+' : '-'}
                {formatCents(amount)}
              </span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const forecast = row.original;

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(forecast)}
                aria-label="Edit forecast"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openDeleteDialog(forecast)}
                aria-label="Delete forecast"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [openEditDialog, openDeleteDialog, getCategoryName],
  );

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
        <div className="page-header">
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <Telescope className="h-5 w-5 text-slate-500" />
            </div>
            Forecast Transactions
          </h1>
          <p className="page-description">
            Projected income, expenses, and savings for a scenario.
          </p>
        </div>
        <div className="empty-state">
          <p className="empty-state-text">Select a scenario to view forecasts.</p>
          <Button asChild className="empty-state-action">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <Telescope className="h-5 w-5 text-slate-500" />
            </div>
            Forecast Transactions
          </h1>
          <p className="page-description">
            Projected income, expenses, and savings for {activeScenario.name}.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={openAddEventDialog}>
              <Plus className="h-4 w-4" />
              Add One-Time
            </Button>
            <Button onClick={openAddRuleDialog}>
              <Plus className="h-4 w-4" />
              Add Recurring
            </Button>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/forecasts/recurring">
              <Settings2 className="h-4 w-4" />
              Manage Recurring
            </Link>
          </Button>
        </div>
      </div>

      <Alert variant="info" className="mb-6">
        Forecast transactions are planned future income, expenses, and savings. They vary by scenario.
      </Alert>

      {!hasAnyForecasts ? (
        <div className="mt-6 space-y-4">
          <div className="empty-state">
            <p className="empty-state-text">No forecasts yet.</p>
            <div className="empty-state-action flex justify-center gap-2">
              <Button variant="outline" onClick={openAddEventDialog}>
                Add one-time event
              </Button>
              <Button onClick={openAddRuleDialog}>
                Add recurring
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <DataTable
          emptyMessage="No forecasts found matching your filters."
          columns={columns}
          data={filteredForecasts}
          searchKey="description"
          searchPlaceholder="Search forecasts..."
          initialSorting={[{ id: 'date', desc: false }]}
          filterSlot={
            <>
              <DateRangeFilter
                startDate={filterStartDate}
                endDate={filterEndDate}
                onStartDateChange={setFilterStartDate}
                onEndDateChange={setFilterEndDate}
                onClear={resetFilters}
                hasFilter={hasDateFilter}
              />
              <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
                <SelectTrigger className={`w-36 ${filterType === 'all' ? 'text-muted-foreground' : ''}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className={`w-44 ${filterCategory === 'all' ? 'text-muted-foreground' : ''}`}>
                  <SelectValue />
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
              <ScenarioSelector hideLabel />
              {hasDateFilter && (
                <Button variant="ghost" size="sm" onClick={resetFilters} title="Reset to defaults">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </>
          }
        />
      )}

      <ForecastEventDialog
        open={eventDialogOpen}
        onOpenChange={handleEventDialogClose}
        scenarioId={activeScenarioId}
        event={editingEvent}
        addEvent={addEvent}
        updateEvent={updateEvent}
      />

      <ForecastRuleDialog
        open={ruleDialogOpen}
        onOpenChange={handleRuleDialogClose}
        scenarioId={activeScenarioId}
        rule={editingRule}
        addRule={addRule}
        updateRule={updateRule}
        onRuleCreated={handleRuleCreated}
      />

      <DeleteForecastDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        forecast={deletingForecast}
        onDeleteOccurrence={handleDeleteOccurrence}
        onDeleteAll={handleDeleteAll}
      />

      {createdRule && (
        <BudgetPromptDialog
          open={budgetPromptOpen}
          onOpenChange={setBudgetPromptOpen}
          categoryId={createdRule.categoryId ?? ''}
          categoryName={createdRuleCategoryName}
          forecastAmountCents={createdRule.amountCents}
          forecastCadence={createdRule.cadence as CadenceType}
          existingBudget={existingBudgetForCreatedRule}
          onAddToBudget={handleAddToBudget}
          onReplaceBudget={handleReplaceBudget}
          onSkip={handleSkipBudget}
        />
      )}
    </div>
  );
}
