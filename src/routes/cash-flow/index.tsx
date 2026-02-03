import { useMemo, useState, useCallback, useEffect } from 'react';
import { Link, useSearchParams, useOutletContext } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  AlertTriangle,
  RotateCcw,
  BanknoteArrowUp,
  BanknoteArrowDown,
  PiggyBank,
  ArrowLeftRight,
  Settings2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Target,
  ArrowLeft,
  Banknote,
} from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';
import { useCategoryRules } from '@/hooks/use-category-rules';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useScenarios } from '@/hooks/use-scenarios';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { DateRangeFilter } from '@/components/date-range-filter';
import { TransactionDialog } from '@/components/dialogs/transaction-dialog';
import { UpImportDialog } from '@/components/up-import-dialog';
import { AddToBudgetDialog } from '@/components/dialogs/add-to-budget-dialog';
import {
  formatCents,
  formatDate,
  today as getToday,
  toMonthlyCents,
  cn,
  type CadenceType,
} from '@/lib/utils';
import type { Transaction, Cadence } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
}

type AveragePeriod = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';
type FilterType = 'all' | 'income' | 'expense' | 'savings' | 'adjustment';
type CategoryFilter = 'all' | 'uncategorized' | string;

// Default date ranges - Past ends at today
const getPastDefaultStartDate = () => '';
const getPastDefaultEndDate = () => getToday();

export function CashFlowPage() {
  const [searchParams] = useSearchParams();
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { isLoading: scenariosLoading } = useScenarios();

  // Check if user came from budget page
  const fromBudget =
    searchParams.get('from') === 'budget' || searchParams.get('from') === 'categories';

  // Section collapse state (persisted, default closed)
  const [pastSectionOpen, setPastSectionOpen] = useLocalStorage('money:pastSectionOpen', false);

  // Average period state
  const [averagePeriod, setAveragePeriod] = useState<AveragePeriod>('monthly');

  // Past section date filter state
  const [pastFilterStartDate, setPastFilterStartDate] = useState(getPastDefaultStartDate);
  const [pastFilterEndDate, setPastFilterEndDate] = useState(getPastDefaultEndDate);
  const hasPastDateFilter =
    pastFilterStartDate !== getPastDefaultStartDate() ||
    pastFilterEndDate !== getPastDefaultEndDate();

  // Shared filter states
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>(() => {
    const categoryParam = searchParams.get('category');
    return categoryParam ?? 'all';
  });

  // Data hooks - Past transactions
  const pastQueryStartDate = pastFilterStartDate || undefined;
  const pastQueryEndDate = pastFilterEndDate || undefined;
  const {
    transactions,
    allTransactions,
    isLoading: transactionsLoading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useTransactions(pastQueryStartDate, pastQueryEndDate);
  const { categories, activeCategories, isLoading: categoriesLoading } = useCategories();
  const { rules: categoryRules } = useCategoryRules();
  const { getRuleForCategory, setBudgetForCategory } = useBudgetRules(activeScenarioId);

  // Combined loading state
  const isLoading = transactionsLoading || categoriesLoading || scenariosLoading;

  // Check if any data exists
  const hasAnyTransactions = allTransactions.length > 0;

  // Dialog states - Past
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [importWarningOpen, setImportWarningOpen] = useState(false);
  const [upImportOpen, setUpImportOpen] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetTransaction, setBudgetTransaction] = useState<Transaction | null>(null);

  const getCategoryName = useCallback(
    (id: string | null) => (id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-'),
    [categories],
  );

  // Past section handlers
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

  const handleDeleteTransaction = useCallback(
    (id: string) => {
      if (deletingTransactionId === id) {
        deleteTransaction(id);
        setDeletingTransactionId(null);
      } else {
        setDeletingTransactionId(id);
      }
    },
    [deletingTransactionId, deleteTransaction],
  );

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

  const handleCreateRecurringBudget = useCallback(
    async (amountCents: number, cadence: Cadence, updateMode: 'add' | 'replace') => {
      if (!budgetTransaction?.categoryId) return;

      const existingBudget = getRuleForCategory(budgetTransaction.categoryId);
      const newMonthly = toMonthlyCents(amountCents, cadence);

      if (updateMode === 'add' && existingBudget) {
        const existingMonthly = toMonthlyCents(
          existingBudget.amountCents,
          existingBudget.cadence as CadenceType,
        );
        await setBudgetForCategory(
          budgetTransaction.categoryId,
          existingMonthly + newMonthly,
          'monthly',
        );
      } else {
        await setBudgetForCategory(budgetTransaction.categoryId, newMonthly, 'monthly');
      }

      setBudgetTransaction(null);
    },
    [budgetTransaction, getRuleForCategory, setBudgetForCategory],
  );

  // Filtered data
  const filteredTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (filterCategory === 'uncategorized' && t.categoryId !== null) return false;
        if (
          filterCategory !== 'all' &&
          filterCategory !== 'uncategorized' &&
          t.categoryId !== filterCategory
        )
          return false;
        return true;
      }),
    [transactions, filterType, filterCategory],
  );

  // Past transaction totals (from queried range)
  const pastTotals = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amountCents, 0);
    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amountCents, 0);
    const savings = transactions
      .filter((t) => t.type === 'savings')
      .reduce((sum, t) => sum + t.amountCents, 0);
    return { income, expenses, savings };
  }, [transactions]);

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
            (lastDate.getMonth() - firstDate.getMonth()) +
            1,
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
    weekly: 'per week',
    fortnightly: 'per fortnight',
    monthly: 'per month',
    quarterly: 'per quarter',
    yearly: 'per year',
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

  // Close delete confirmation on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deletingTransactionId) setDeletingTransactionId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deletingTransactionId]);

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
                <BanknoteArrowUp className="h-3 w-3" />
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
              <BanknoteArrowDown className="h-3 w-3" />
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
            <Link to={`/categories/${categoryId}`} className="hover:underline">
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
          const tooltipText =
            type === 'income' ? 'Earned' : type === 'adjustment' ? 'Adjustment' : 'Spent';
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
                <TooltipContent>{tooltipText}</TooltipContent>
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
          const canAddToBudget =
            transaction.type === 'expense' && transaction.categoryId && activeScenarioId;

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
    [
      deletingTransactionId,
      openEditTransactionDialog,
      handleDeleteTransaction,
      getCategoryName,
      openBudgetDialog,
      activeScenarioId,
    ],
  );

  if (isLoading) {
    return (
      <div className="page-shell">
        <PageLoading />
      </div>
    );
  }

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

      {/* Page Header */}
      <div className="page-header mb-8">
        <h1 className="page-title">
          <div className="page-title-icon bg-slate-500/10">
            <Banknote className="h-5 w-5 text-slate-500" />
          </div>
          Past Averages
        </h1>
        <p className="page-description">View your past average income, expenses, and savings</p>
      </div>

      {/* Summary Section */}
      <div className="mb-8">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
              Based on {transactionDateRange.count.toLocaleString()} transactions from{' '}
              {transactionDateRange.from} to {transactionDateRange.to}
            </p>
          )}
        </div>

        {hasAnyTransactions ? (
          <>
            {/* Net Status Hero */}
            <div className="mb-6 min-h-28 text-center sm:min-h-32">
              <div className="min-h-8" />
              <p
                className={cn(
                  'flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide',
                  periodAverages.net >= 0 ? 'text-green-500' : 'text-red-500',
                )}
              >
                <ArrowLeftRight className="h-4 w-4" />
                {periodAverages.net >= 0 ? 'Net Gain' : 'Net Loss'}
              </p>
              <p
                className={cn(
                  'mt-2 text-5xl font-bold tracking-tight',
                  periodAverages.net >= 0 ? 'text-green-500' : 'text-red-500',
                )}
              >
                {periodAverages.net >= 0 ? '+' : '-'}
                {formatCents(Math.abs(periodAverages.net))}
              </p>
              <div className="mx-auto mt-4 mb-3 h-px w-24 bg-border" />
              <p className="text-sm text-muted-foreground">
                {periodAverages.net >= 0
                  ? `You earn more than you spend ${periodLabels[averagePeriod]}`
                  : `You spend more than you earn ${periodLabels[averagePeriod]}`}
              </p>
            </div>

            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2">
                  <BanknoteArrowUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Average Earned</span>
                </div>
                <p className="mt-2 text-2xl font-bold">{formatCents(periodAverages.income)}</p>
                <p className="text-sm text-muted-foreground">{periodLabels[averagePeriod]}</p>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2">
                  <BanknoteArrowDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Average Spent</span>
                </div>
                <p className="mt-2 text-2xl font-bold">{formatCents(periodAverages.expenses)}</p>
                <p className="text-sm text-muted-foreground">{periodLabels[averagePeriod]}</p>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Average Saved</span>
                </div>
                <p className="mt-2 text-2xl font-bold">{formatCents(periodAverages.savings)}</p>
                <p className="text-sm text-muted-foreground">{periodLabels[averagePeriod]}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No transactions yet.{' '}
            <button
              onClick={openAddTransactionDialog}
              className="cursor-pointer text-primary hover:underline"
            >
              Add your first transaction
            </button>{' '}
            to see averages.
          </p>
        )}
      </div>

      {/* Past Transactions Section */}
      <Collapsible open={pastSectionOpen} onOpenChange={setPastSectionOpen} className="mb-6">
        <div className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between bg-card p-4">
            <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-2">
              {pastSectionOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <RotateCcw className="h-4 w-4 text-amber-500" />
              <span className="font-medium">Past Transactions</span>
              {transactions.length > 0 ? (
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  <span className="text-green-600">+{formatCents(pastTotals.income)}</span>
                  {' / '}
                  <span className="text-red-600">-{formatCents(pastTotals.expenses)}</span>
                  {pastTotals.savings > 0 && (
                    <>
                      {' / '}
                      <span className="text-blue-600">{formatCents(pastTotals.savings)} saved</span>
                    </>
                  )}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  ({filteredTransactions.length})
                </span>
              )}
            </CollapsibleTrigger>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/categories/import-rules?from=cash-flow">
                        <Settings2 className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Import Rules</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="secondary" size="sm" onClick={handleImportClick}>
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Import</span>
              </Button>
              <Button size="sm" onClick={openAddTransactionDialog}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add</span>
              </Button>
            </div>
          </div>
          <CollapsibleContent>
            <div className="border-t p-4">
              {!hasAnyTransactions ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No transactions yet.{' '}
                  <button
                    onClick={openAddTransactionDialog}
                    className="cursor-pointer text-primary hover:underline"
                  >
                    Add your first transaction
                  </button>
                </p>
              ) : (
                <DataTable
                  emptyMessage="No transactions found matching your filters."
                  columns={transactionColumns}
                  data={filteredTransactions}
                  searchKey="description"
                  searchPlaceholder="Search transactions..."
                  initialSorting={[{ id: 'date', desc: true }]}
                  pageSize={10}
                  filterSlot={
                    <>
                      <DateRangeFilter
                        startDate={pastFilterStartDate}
                        endDate={pastFilterEndDate}
                        onStartDateChange={setPastFilterStartDate}
                        onEndDateChange={setPastFilterEndDate}
                        onClear={resetPastFilters}
                        hasFilter={hasPastDateFilter}
                        maxEndDate={getToday()}
                      />
                      <Select
                        value={filterType}
                        onValueChange={(v) => setFilterType(v as FilterType)}
                      >
                        <SelectTrigger
                          className={`w-36 ${filterType === 'all' ? 'text-muted-foreground' : ''}`}
                        >
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
                        <SelectTrigger
                          className={`w-44 ${filterCategory === 'all' ? 'text-muted-foreground' : ''}`}
                        >
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={resetPastFilters}
                          title="Reset to defaults"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  }
                />
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Dialogs */}
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
      />

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
            <Button onClick={handleSkipWarning}>Continue Without Rules</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
