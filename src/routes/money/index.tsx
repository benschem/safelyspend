import { useMemo, useState, useCallback, useEffect } from 'react';
import { Link, useSearchParams, useOutletContext } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, Pencil, Trash2, Download, AlertTriangle, Receipt, RotateCcw, TrendingUp, TrendingDown, PiggyBank, ArrowLeftRight, Settings2, ChevronUp, ChevronDown, Target, Repeat, ArrowLeft } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';
import { useCategoryRules } from '@/hooks/use-category-rules';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useForecasts } from '@/hooks/use-forecasts';
import { useScenarios } from '@/hooks/use-scenarios';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { DateRangeFilter } from '@/components/date-range-filter';
import { TransactionDialog } from '@/components/dialogs/transaction-dialog';
import { UpImportDialog } from '@/components/up-import-dialog';
import { AddToBudgetDialog } from '@/components/dialogs/add-to-budget-dialog';
import { ExpectedTransactionDialog } from '@/components/dialogs/expected-transaction-dialog';
import { ForecastRuleDialog } from '@/components/dialogs/forecast-rule-dialog';
import { DeleteForecastDialog } from '@/components/dialogs/delete-forecast-dialog';
import { BudgetPromptDialog } from '@/components/dialogs/budget-prompt-dialog';
import { ScenarioSelector } from '@/components/scenario-selector';
import { formatCents, formatDate, today as getToday, toMonthlyCents, cn, type CadenceType } from '@/lib/utils';
import type { Transaction, Cadence, ExpandedForecast, ForecastEvent, ForecastRule } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
}

type TabValue = 'past' | 'expected' | 'averages';
type AveragePeriod = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';
type FilterType = 'all' | 'income' | 'expense' | 'savings' | 'adjustment';
type ExpectedFilterType = 'all' | 'income' | 'expense' | 'savings';
type CategoryFilter = 'all' | 'uncategorized' | string;

// Default date ranges
const getPastDefaultStartDate = () => '';
const getPastDefaultEndDate = () => getToday();
const getExpectedDefaultStartDate = () => getToday();
const getExpectedDefaultEndDate = () => '';

export function MoneyIndexPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario, isLoading: scenariosLoading } = useScenarios();

  // Tab state from URL param
  const [activeTab, setActiveTab] = useState<TabValue>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'expected') return 'expected';
    if (tabParam === 'averages') return 'averages';
    return 'past';
  });

  // Average period state
  const [averagePeriod, setAveragePeriod] = useState<AveragePeriod>('monthly');

  // Check if user came from budget page
  const fromBudget = searchParams.get('from') === 'budget' || searchParams.get('from') === 'categories';

  // Update URL when tab changes
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (activeTab === 'past' && currentTab) {
      setSearchParams({}, { replace: true });
    } else if (activeTab !== 'past' && currentTab !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams]);

  // Past tab date filter state
  const [pastFilterStartDate, setPastFilterStartDate] = useState(getPastDefaultStartDate);
  const [pastFilterEndDate, setPastFilterEndDate] = useState(getPastDefaultEndDate);
  const hasPastDateFilter = pastFilterStartDate !== getPastDefaultStartDate() || pastFilterEndDate !== getPastDefaultEndDate();

  // Expected tab date filter state
  const [expectedFilterStartDate, setExpectedFilterStartDate] = useState(getExpectedDefaultStartDate);
  const [expectedFilterEndDate, setExpectedFilterEndDate] = useState(getExpectedDefaultEndDate);
  const hasExpectedDateFilter = expectedFilterStartDate !== getExpectedDefaultStartDate() || expectedFilterEndDate !== getExpectedDefaultEndDate();

  // Shared filter states
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [expectedFilterType, setExpectedFilterType] = useState<ExpectedFilterType>('all');
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>(() => {
    const categoryParam = searchParams.get('category');
    return categoryParam ?? 'all';
  });

  // Data hooks - Past transactions
  const pastQueryStartDate = pastFilterStartDate || undefined;
  const pastQueryEndDate = pastFilterEndDate || undefined;
  const { transactions, allTransactions, isLoading: transactionsLoading, addTransaction, updateTransaction, deleteTransaction } = useTransactions(pastQueryStartDate, pastQueryEndDate);
  const { categories, activeCategories, isLoading: categoriesLoading } = useCategories();
  const { rules: categoryRules } = useCategoryRules();
  const { getRuleForCategory, setBudgetForCategory } = useBudgetRules(activeScenarioId);

  // Data hooks - Expected forecasts
  const defaultStart = '2020-01-01';
  const defaultEnd = '2099-12-31';
  const expectedQueryStartDate = expectedFilterStartDate || defaultStart;
  const expectedQueryEndDate = expectedFilterEndDate || defaultEnd;
  const { expandedForecasts, rules, events, isLoading: forecastsLoading, addRule, updateRule, deleteRule, excludeOccurrence, addEvent, updateEvent, deleteEvent } = useForecasts(activeScenarioId, expectedQueryStartDate, expectedQueryEndDate);

  // Budget prompt preference
  const [skipBudgetPrompt, setSkipBudgetPrompt] = useLocalStorage('budget:skipBudgetPrompt', false);

  // Combined loading state
  const isLoading = transactionsLoading || categoriesLoading ||
    (activeTab === 'expected' && (scenariosLoading || forecastsLoading));

  // Check if any data exists
  const hasAnyTransactions = allTransactions.length > 0;
  const hasAnyForecasts = rules.length > 0 || events.length > 0;

  // Dialog states - Past
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [importWarningOpen, setImportWarningOpen] = useState(false);
  const [upImportOpen, setUpImportOpen] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetTransaction, setBudgetTransaction] = useState<Transaction | null>(null);

  // Dialog states - Expected (one-time events)
  const [expectedDialogOpen, setExpectedDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ForecastEvent | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingForecast, setDeletingForecast] = useState<ExpandedForecast | null>(null);

  // Dialog states - Recurring rules
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ForecastRule | null>(null);

  // Budget prompt dialog state (for expected)
  const [budgetPromptOpen, setBudgetPromptOpen] = useState(false);
  const [createdRule, setCreatedRule] = useState<ForecastRule | null>(null);

  const getCategoryName = useCallback(
    (id: string | null) => (id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-'),
    [categories],
  );

  // Past tab handlers
  const handleImportClick = useCallback(() => {
    if (categoryRules.length === 0) {
      setImportWarningOpen(true);
    } else {
      setUpImportOpen(true);
    }
  }, [categoryRules.length]);

  const handleSkipWarning = useCallback(() => {
    setImportWarningOpen(false);
    setUpImportOpen(true);
  }, []);

  const resetPastFilters = useCallback(() => {
    setPastFilterStartDate(getPastDefaultStartDate());
    setPastFilterEndDate(getPastDefaultEndDate());
  }, []);

  const resetExpectedFilters = useCallback(() => {
    setExpectedFilterStartDate(getExpectedDefaultStartDate());
    setExpectedFilterEndDate(getExpectedDefaultEndDate());
  }, []);

  const openAddTransactionDialog = useCallback(() => {
    setEditingTransaction(null);
    setTransactionDialogOpen(true);
  }, []);

  const openEditTransactionDialog = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setTransactionDialogOpen(true);
  }, []);

  const handleTransactionDialogClose = useCallback((open: boolean) => {
    setTransactionDialogOpen(open);
    if (!open) {
      setEditingTransaction(null);
    }
  }, []);

  const handleDeleteTransaction = useCallback((id: string) => {
    if (deletingTransactionId === id) {
      deleteTransaction(id);
      setDeletingTransactionId(null);
    } else {
      setDeletingTransactionId(id);
    }
  }, [deletingTransactionId, deleteTransaction]);

  const openBudgetDialog = useCallback((transaction: Transaction) => {
    setBudgetTransaction(transaction);
    setBudgetDialogOpen(true);
  }, []);

  const budgetTransactionCategoryName = useMemo(() => {
    if (!budgetTransaction?.categoryId) return '';
    return categories.find((c) => c.id === budgetTransaction.categoryId)?.name ?? 'Unknown';
  }, [budgetTransaction, categories]);

  const existingBudgetForTransaction = useMemo(() => {
    if (!budgetTransaction?.categoryId) return null;
    return getRuleForCategory(budgetTransaction.categoryId);
  }, [budgetTransaction, getRuleForCategory]);

  const handleCreateRecurringBudget = useCallback(async (amountCents: number, cadence: Cadence, updateMode: 'add' | 'replace') => {
    if (!budgetTransaction?.categoryId) return;

    const existingBudget = getRuleForCategory(budgetTransaction.categoryId);
    const newMonthly = toMonthlyCents(amountCents, cadence);

    if (updateMode === 'add' && existingBudget) {
      const existingMonthly = toMonthlyCents(existingBudget.amountCents, existingBudget.cadence as CadenceType);
      await setBudgetForCategory(budgetTransaction.categoryId, existingMonthly + newMonthly, 'monthly');
    } else {
      await setBudgetForCategory(budgetTransaction.categoryId, newMonthly, 'monthly');
    }

    setBudgetTransaction(null);
  }, [budgetTransaction, getRuleForCategory, setBudgetForCategory]);

  const handleCreateOneTimeForecast = useCallback(async (amountCents: number) => {
    if (!budgetTransaction?.categoryId || !activeScenarioId) return;

    await addEvent({
      scenarioId: activeScenarioId,
      type: 'expense',
      description: `Budget allowance: ${budgetTransaction.description}`,
      amountCents,
      date: getToday(),
      categoryId: budgetTransaction.categoryId,
      savingsGoalId: null,
    });

    setBudgetTransaction(null);
  }, [budgetTransaction, activeScenarioId, addEvent]);

  // Expected tab handlers
  const openAddExpectedDialog = useCallback(() => {
    setEditingEvent(null);
    setExpectedDialogOpen(true);
  }, []);

  const openAddRecurringDialog = useCallback(() => {
    setEditingRule(null);
    setRecurringDialogOpen(true);
  }, []);

  const openEditExpectedDialog = useCallback((forecast: ExpandedForecast) => {
    if (forecast.sourceType === 'rule') {
      const rule = rules.find(r => r.id === forecast.sourceId);
      if (rule) {
        setEditingRule(rule);
        setRecurringDialogOpen(true);
      }
    } else {
      const event = events.find(e => e.id === forecast.sourceId);
      if (event) {
        setEditingEvent(event);
        setExpectedDialogOpen(true);
      }
    }
  }, [rules, events]);

  const handleExpectedDialogClose = useCallback((open: boolean) => {
    setExpectedDialogOpen(open);
    if (!open) {
      setEditingEvent(null);
    }
  }, []);

  const handleRecurringDialogClose = useCallback((open: boolean) => {
    setRecurringDialogOpen(open);
    if (!open) {
      setEditingRule(null);
    }
  }, []);

  const openDeleteForecastDialog = useCallback((forecast: ExpandedForecast) => {
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

  // Handle when rule is created
  const handleRuleCreated = useCallback((rule: ForecastRule) => {
    if (rule.type === 'expense' && rule.categoryId && !skipBudgetPrompt) {
      setCreatedRule(rule);
      setBudgetPromptOpen(true);
    }
  }, [skipBudgetPrompt]);

  const createdRuleCategoryName = useMemo(() => {
    if (!createdRule?.categoryId) return '';
    return categories.find((c) => c.id === createdRule.categoryId)?.name ?? 'Unknown';
  }, [createdRule, categories]);

  const existingBudgetForCreatedRule = useMemo(() => {
    if (!createdRule?.categoryId) return null;
    return getRuleForCategory(createdRule.categoryId);
  }, [createdRule, getRuleForCategory]);

  const handleAddToBudget = useCallback(async (dontAskAgain: boolean) => {
    if (!createdRule?.categoryId) return;

    const existingBudget = getRuleForCategory(createdRule.categoryId);
    const newMonthly = toMonthlyCents(createdRule.amountCents, createdRule.cadence as CadenceType);
    const existingMonthly = existingBudget
      ? toMonthlyCents(existingBudget.amountCents, existingBudget.cadence as CadenceType)
      : 0;

    await setBudgetForCategory(createdRule.categoryId, existingMonthly + newMonthly, 'monthly');

    if (dontAskAgain) setSkipBudgetPrompt(true);
    setCreatedRule(null);
  }, [createdRule, getRuleForCategory, setBudgetForCategory, setSkipBudgetPrompt]);

  const handleReplaceBudget = useCallback(async (dontAskAgain: boolean) => {
    if (!createdRule?.categoryId) return;

    const newMonthly = toMonthlyCents(createdRule.amountCents, createdRule.cadence as CadenceType);
    await setBudgetForCategory(createdRule.categoryId, newMonthly, 'monthly');

    if (dontAskAgain) setSkipBudgetPrompt(true);
    setCreatedRule(null);
  }, [createdRule, setBudgetForCategory, setSkipBudgetPrompt]);

  const handleSkipBudget = useCallback((dontAskAgain: boolean) => {
    if (dontAskAgain) setSkipBudgetPrompt(true);
    setCreatedRule(null);
  }, [setSkipBudgetPrompt]);

  // Filtered data
  const filteredTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (filterCategory === 'uncategorized' && t.categoryId !== null) return false;
        if (filterCategory !== 'all' && filterCategory !== 'uncategorized' && t.categoryId !== filterCategory) return false;
        return true;
      }),
    [transactions, filterType, filterCategory],
  );

  const filteredForecasts = useMemo(
    () => expandedForecasts.filter((f) => {
      if (expectedFilterType !== 'all' && f.type !== expectedFilterType) return false;
      if (filterCategory !== 'all' && f.categoryId !== filterCategory) return false;
      return true;
    }),
    [expandedForecasts, expectedFilterType, filterCategory],
  );

  // Period averages calculation
  const periodAverages = useMemo(() => {
    if (allTransactions.length === 0) {
      return { income: 0, expenses: 0, savings: 0, net: 0 };
    }

    // Find date range from transactions
    const dates = allTransactions.map((t) => new Date(t.date));
    const firstDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const lastDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Calculate days between first and last transaction
    const daysDiff = Math.max(
      1,
      Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );

    // Calculate periods based on selected period type
    let periods: number;
    switch (averagePeriod) {
      case 'weekly':
        periods = Math.max(1, daysDiff / 7);
        break;
      case 'fortnightly':
        periods = Math.max(1, daysDiff / 14);
        break;
      case 'monthly':
        periods = Math.max(
          1,
          (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
            (lastDate.getMonth() - firstDate.getMonth()) + 1,
        );
        break;
      case 'quarterly':
        periods = Math.max(1, daysDiff / 91);
        break;
      case 'yearly':
        periods = Math.max(1, daysDiff / 365);
        break;
    }

    const totalIncome = allTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amountCents, 0);

    const totalExpenses = allTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amountCents, 0);

    const totalSavingsAmount = allTransactions
      .filter((t) => t.type === 'savings')
      .reduce((sum, t) => sum + t.amountCents, 0);

    const income = Math.round(totalIncome / periods);
    const expenses = Math.round(totalExpenses / periods);
    const savings = Math.round(totalSavingsAmount / periods);

    return {
      income,
      expenses,
      savings,
      net: income - expenses - savings,
    };
  }, [allTransactions, averagePeriod]);

  const periodLabels: Record<AveragePeriod, string> = {
    weekly: 'Weekly',
    fortnightly: 'Fortnightly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
  };

  // Get date range for averages display
  const transactionDateRange = useMemo(() => {
    if (allTransactions.length === 0) return null;
    const dates = allTransactions.map((t) => new Date(t.date));
    const firstDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const lastDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    return {
      from: formatDate(firstDate.toISOString().slice(0, 10)),
      to: formatDate(lastDate.toISOString().slice(0, 10)),
      count: allTransactions.length,
    };
  }, [allTransactions]);

  // Past transactions columns
  const transactionColumns: ColumnDef<Transaction>[] = useMemo(
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
          const transaction = row.original;
          if (transaction.notes) {
            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => openEditTransactionDialog(transaction)}
                      className="cursor-pointer text-left font-medium hover:underline"
                    >
                      {row.getValue('description')}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="whitespace-pre-wrap">{transaction.notes}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }
          return (
            <button
              type="button"
              onClick={() => openEditTransactionDialog(transaction)}
              className="cursor-pointer text-left font-medium hover:underline"
            >
              {row.getValue('description')}
            </button>
          );
        },
        filterFn: (row, _columnId, filterValue: string) => {
          const search = filterValue.toLowerCase();
          const description = row.original.description?.toLowerCase() ?? '';
          const notes = row.original.notes?.toLowerCase() ?? '';
          return description.includes(search) || notes.includes(search);
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
          if (type === 'adjustment') {
            return (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <ArrowLeftRight className="h-3 w-3" />
                Adjustment
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
        filterFn: (row, id, value) => {
          if (value === 'all') return true;
          return row.getValue(id) === value;
        },
      },
      {
        accessorKey: 'categoryId',
        header: 'Category',
        cell: ({ row }) => {
          const categoryId = row.original.categoryId;
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
          const transaction = row.original;
          const type = transaction.type;
          const amount = row.getValue('amountCents') as number;

          if (type === 'savings') {
            const isWithdrawal = amount < 0;
            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex cursor-default items-center justify-end gap-1 font-mono text-blue-600">
                      {isWithdrawal ? (
                        <ChevronDown className="h-4 w-4 text-red-500" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-green-500" />
                      )}
                      {formatCents(Math.abs(amount))}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isWithdrawal ? 'Withdrawn from savings' : 'Contributed to savings'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          const isPositive = type === 'income' || type === 'adjustment';
          const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
          const tooltipText = type === 'income' ? 'Earned' : type === 'adjustment' ? 'Adjustment' : 'Spent';
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-default text-right font-mono">
                    <span className={colorClass}>
                      {isPositive ? '+' : '-'}
                      {formatCents(amount)}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {tooltipText}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const transaction = row.original;
          const isDeleting = deletingTransactionId === transaction.id;
          const canAddToBudget = transaction.type === 'expense' && transaction.categoryId && activeScenarioId;

          return (
            <TooltipProvider>
              <div className="flex justify-end gap-1">
                {canAddToBudget && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openBudgetDialog(transaction)}
                        aria-label="Add to budget"
                      >
                        <Target className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add to budget</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditTransactionDialog(transaction)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isDeleting ? 'destructive' : 'ghost'}
                      size="sm"
                      onClick={() => handleDeleteTransaction(transaction.id)}
                      onBlur={() => setTimeout(() => setDeletingTransactionId(null), 200)}
                      aria-label={isDeleting ? 'Confirm delete' : 'Delete'}
                    >
                      {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isDeleting ? 'Click to confirm' : 'Delete'}</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          );
        },
      },
    ],
    [deletingTransactionId, openEditTransactionDialog, handleDeleteTransaction, getCategoryName, openBudgetDialog, activeScenarioId],
  );

  // Expected forecasts columns
  const forecastColumns: ColumnDef<ExpandedForecast>[] = useMemo(
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
              onClick={() => openEditExpectedDialog(forecast)}
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

          if (type === 'savings') {
            const isWithdrawal = amount < 0;
            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex cursor-default items-center justify-end gap-1 font-mono text-blue-600">
                      {isWithdrawal ? (
                        <ChevronDown className="h-4 w-4 text-red-500" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-green-500" />
                      )}
                      {formatCents(Math.abs(amount))}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isWithdrawal ? 'Expected withdrawal from savings' : 'Expected contribution to savings'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          const colorClass = type === 'income' ? 'text-green-600' : 'text-red-600';
          const tooltipText = type === 'income' ? 'Expected income' : 'Expected expense';
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-default text-right font-mono">
                    <span className={colorClass}>
                      {type === 'income' ? '+' : '-'}
                      {formatCents(amount)}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {tooltipText}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const forecast = row.original;

          return (
            <TooltipProvider>
              <div className="flex justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditExpectedDialog(forecast)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteForecastDialog(forecast)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          );
        },
      },
    ],
    [openEditExpectedDialog, openDeleteForecastDialog, getCategoryName],
  );

  // Get the right action button based on tab
  // Both tabs use the same layout structure to prevent layout jump
  const getActionButton = () => {
    return (
      <div className="flex gap-2">
        {/* Import column - only visible on Past tab but takes space on both */}
        <div className={cn('flex flex-col gap-1', activeTab !== 'past' && 'invisible')}>
          <Button variant="secondary" onClick={handleImportClick}>
            <Download className="h-4 w-4" />
            Import CSV
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/categories/import-rules?from=money">
              <Settings2 className="h-4 w-4" />
              Import Rules
            </Link>
          </Button>
        </div>
        {/* Add button - changes based on tab */}
        {activeTab === 'past' ? (
          <Button onClick={openAddTransactionDialog}>
            <Plus className="h-4 w-4" />
            Add Past
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={openAddRecurringDialog}>
              <Repeat className="h-4 w-4" />
              Add Recurring
            </Button>
            <Button onClick={openAddExpectedDialog}>
              <Plus className="h-4 w-4" />
              Add Expected
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="page-shell">
      {fromBudget && (
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
          <Link to="/budget">
            <ArrowLeft className="h-4 w-4" />
            Back to Budget
          </Link>
        </Button>
      )}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <Receipt className="h-5 w-5 text-slate-500" />
            </div>
            Money In/Out
          </h1>
          <p className="page-description">
            {activeTab === 'past' && 'Actual income, expenses, and savings.'}
            {activeTab === 'expected' && `Expected income, expenses, and savings${activeScenario ? ` for ${activeScenario.name}` : ''}.`}
            {activeTab === 'averages' && 'Average income, expenses, and savings based on your transaction history.'}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {getActionButton()}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 inline-flex h-10 items-center rounded-lg bg-muted p-1 text-muted-foreground">
        <button
          type="button"
          onClick={() => setActiveTab('past')}
          className={cn(
            'inline-flex h-8 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-medium transition-all',
            activeTab === 'past'
              ? 'bg-background text-foreground shadow-sm'
              : 'hover:text-foreground',
          )}
        >
          Past
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('expected')}
          className={cn(
            'inline-flex h-8 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-medium transition-all',
            activeTab === 'expected'
              ? 'bg-background text-foreground shadow-sm'
              : 'hover:text-foreground',
          )}
        >
          Expected
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('averages')}
          className={cn(
            'inline-flex h-8 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-medium transition-all',
            activeTab === 'averages'
              ? 'bg-background text-foreground shadow-sm'
              : 'hover:text-foreground',
          )}
        >
          Averages
        </button>
      </div>

      {isLoading ? (
        <PageLoading />
      ) : activeTab === 'past' ? (
        // Past tab content
        !hasAnyTransactions ? (
          <div className="space-y-4">
            <Alert variant="info">
              Past transactions are actual income, expenses, and savings that have already occurred.
            </Alert>
            <div className="empty-state">
              <p className="empty-state-text">No transactions yet.</p>
              <Button onClick={openAddTransactionDialog} className="empty-state-action">
                Add a transaction
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Alert variant="info" className="mb-6">
              Past transactions are actual income, expenses, and savings that have already occurred.
            </Alert>
            <DataTable
              emptyMessage="No transactions found matching your filters."
              columns={transactionColumns}
              data={filteredTransactions}
              searchKey="description"
              searchPlaceholder="Search transactions..."
              initialSorting={[{ id: 'date', desc: true }]}
              filterSlot={
                <>
                  <DateRangeFilter
                    startDate={pastFilterStartDate}
                    endDate={pastFilterEndDate}
                    onStartDateChange={setPastFilterStartDate}
                    onEndDateChange={setPastFilterEndDate}
                    onClear={resetPastFilters}
                    hasFilter={hasPastDateFilter}
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
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className={`w-44 ${filterCategory === 'all' ? 'text-muted-foreground' : ''}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="uncategorized">Uncategorised</SelectItem>
                      {activeCategories
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {hasPastDateFilter && (
                    <Button variant="ghost" size="sm" onClick={resetPastFilters} title="Reset to defaults">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </>
              }
            />
          </>
        )
      ) : activeTab === 'expected' ? (
        // Expected tab content
        !activeScenarioId || !activeScenario ? (
          <div className="empty-state">
            <p className="empty-state-text">Select a scenario to view expected transactions.</p>
            <Button asChild className="empty-state-action">
              <Link to="/scenarios">Manage Scenarios</Link>
            </Button>
          </div>
        ) : !hasAnyForecasts ? (
          <div className="space-y-4">
            <Alert variant="info">
              Expected transactions are known future income, expenses, and savings. They vary by scenario.
            </Alert>
            <div className="empty-state">
              <p className="empty-state-text">No expected transactions yet.</p>
              <Button onClick={openAddExpectedDialog} className="empty-state-action">
                Add expected transaction
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Alert variant="info" className="mb-6">
              Expected transactions are known future income, expenses, and savings. They vary by scenario.
            </Alert>
            <DataTable
              emptyMessage="No expected transactions found matching your filters."
              columns={forecastColumns}
              data={filteredForecasts}
              searchKey="description"
              searchPlaceholder="Search expected..."
              initialSorting={[{ id: 'date', desc: false }]}
              filterSlot={
                <>
                  <DateRangeFilter
                    startDate={expectedFilterStartDate}
                    endDate={expectedFilterEndDate}
                    onStartDateChange={setExpectedFilterStartDate}
                    onEndDateChange={setExpectedFilterEndDate}
                    onClear={resetExpectedFilters}
                    hasFilter={hasExpectedDateFilter}
                  />
                  <Select value={expectedFilterType} onValueChange={(v) => setExpectedFilterType(v as ExpectedFilterType)}>
                    <SelectTrigger className={`w-36 ${expectedFilterType === 'all' ? 'text-muted-foreground' : ''}`}>
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
                  {hasExpectedDateFilter && (
                    <Button variant="ghost" size="sm" onClick={resetExpectedFilters} title="Reset to defaults">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </>
              }
            />
          </>
        )
      ) : activeTab === 'averages' ? (
        // Averages tab content
        !hasAnyTransactions ? (
          <div className="empty-state">
            <p className="empty-state-text">No transactions yet to calculate averages.</p>
            <Button onClick={openAddTransactionDialog} className="empty-state-action">
              Add a transaction
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Period dropdown and explanation */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Select value={averagePeriod} onValueChange={(v) => setAveragePeriod(v as AveragePeriod)}>
                <SelectTrigger className="w-36">
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
              {transactionDateRange && (
                <p className="text-sm text-muted-foreground">
                  Based on {transactionDateRange.count.toLocaleString()} transactions from {transactionDateRange.from} to {transactionDateRange.to}
                </p>
              )}
            </div>

            {/* Stats cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Earned card */}
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">{periodLabels[averagePeriod]} Earned</span>
                </div>
                <p className="mt-2 text-2xl font-bold">{formatCents(periodAverages.income)}</p>
              </div>

              {/* Spent card */}
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">{periodLabels[averagePeriod]} Spent</span>
                </div>
                <p className="mt-2 text-2xl font-bold">{formatCents(periodAverages.expenses)}</p>
              </div>

              {/* Saved card */}
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">{periodLabels[averagePeriod]} Saved</span>
                </div>
                <p className="mt-2 text-2xl font-bold">{formatCents(periodAverages.savings)}</p>
              </div>

              {/* Net card */}
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{periodLabels[averagePeriod]} Net</span>
                </div>
                <p className={cn(
                  'mt-2 text-2xl font-bold',
                  periodAverages.net >= 0 ? 'text-green-600' : 'text-red-600',
                )}>
                  {periodAverages.net >= 0 ? '+' : ''}{formatCents(periodAverages.net)}
                </p>
              </div>
            </div>
          </div>
        )
      ) : null}

      {/* Past tab dialogs */}
      <TransactionDialog
        open={transactionDialogOpen}
        onOpenChange={handleTransactionDialogClose}
        transaction={editingTransaction}
        addTransaction={addTransaction}
        updateTransaction={updateTransaction}
      />

      <UpImportDialog open={upImportOpen} onOpenChange={setUpImportOpen} />

      <AddToBudgetDialog
        open={budgetDialogOpen}
        onOpenChange={setBudgetDialogOpen}
        transaction={budgetTransaction}
        categoryName={budgetTransactionCategoryName}
        existingBudget={existingBudgetForTransaction}
        onCreateRecurringBudget={handleCreateRecurringBudget}
        onCreateOneTimeForecast={handleCreateOneTimeForecast}
      />

      {/* Warning dialog for no category rules */}
      <Dialog open={importWarningOpen} onOpenChange={setImportWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              No Import Rules Set
            </DialogTitle>
            <DialogDescription>
              You haven&apos;t set up any category import rules yet. Without rules, imported
              transactions won&apos;t be automatically categorised.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Would you like to set up rules first, or continue without auto-categorisation?
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setImportWarningOpen(false)} asChild>
              <Link to="/categories/import-rules">Set Up Rules</Link>
            </Button>
            <Button onClick={handleSkipWarning}>
              Continue Without Rules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expected tab dialogs */}
      <ExpectedTransactionDialog
        open={expectedDialogOpen}
        onOpenChange={handleExpectedDialogClose}
        scenarioId={activeScenarioId}
        event={editingEvent}
        addEvent={addEvent}
        updateEvent={updateEvent}
      />

      <ForecastRuleDialog
        open={recurringDialogOpen}
        onOpenChange={handleRecurringDialogClose}
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
