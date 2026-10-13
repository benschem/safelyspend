import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Link, useSearchParams } from 'react-router';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import {
  Pencil,
  Trash2,
  Plus,
  PiggyBank,
  Banknote,
  ChevronDown,
  ChevronUp,
  BanknoteArrowUp,
  BanknoteArrowDown,
  ArrowLeftRight,
  History,
  RotateCcw,
  Download,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import { daysBetween, parseLocalDate, today as getToday } from '@/lib/dates';
import { cn, formatCents, formatDate } from '@/lib/utils';
import { useCategories } from '@/hooks/use-categories';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategoryRules } from '@/hooks/use-category-rules';
import { TransactionDialog } from '@/components/dialogs/transaction-dialog';
import { UpImportDialog } from '@/components/up-import-dialog';
import { CsvImportDialog } from '@/components/csv-import-dialog';
import { BulkCategoryDialog } from '@/components/dialogs/bulk-category-dialog';
import { DateRangeFilter } from '@/components/date-range-filter';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Transaction } from '@/lib/types';

type FilterType = 'all' | 'income' | 'expense' | 'savings' | 'adjustment';
type CategoryFilter = 'all' | 'uncategorized' | string;
type AverageCadence = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

// Default date ranges - Past ends at today
const getPastDefaultStartDate = () => '';
const getPastDefaultEndDate = () => getToday();

/**
 * The earliest and latest dates among some transactions. YYYY-MM-DD strings
 * sort in date order, so they are compared as text. Needs at least one
 * transaction.
 */
function firstAndLastDates(transactions: Transaction[]): {
  firstDateStr: string;
  lastDateStr: string;
} {
  let firstDateStr = transactions[0]!.date;
  let lastDateStr = firstDateStr;
  for (const transaction of transactions) {
    if (transaction.date < firstDateStr) firstDateStr = transaction.date;
    if (transaction.date > lastDateStr) lastDateStr = transaction.date;
  }
  return { firstDateStr, lastDateStr };
}

const FREQUENCY_PER_LABELS: Record<AverageCadence, string> = {
  weekly: 'per week',
  fortnightly: 'per fortnight',
  monthly: 'per month',
  quarterly: 'per quarter',
  yearly: 'per year',
};

export function TransactionsPage() {
  const [searchParams] = useSearchParams();
  const { categories, activeCategories } = useCategories();
  const { rules: categoryRules, addRule, getNextPriority } = useCategoryRules();

  // Past section date filter state
  const [pastFilterStartDate, setPastFilterStartDate] = useState(getPastDefaultStartDate);
  const [pastFilterEndDate, setPastFilterEndDate] = useState(getPastDefaultEndDate);
  const hasPastDateFilter =
    pastFilterStartDate !== getPastDefaultStartDate() ||
    pastFilterEndDate !== getPastDefaultEndDate();

  // Transaction hooks with date filtering
  const pastQueryStartDate = pastFilterStartDate || undefined;
  const pastQueryEndDate = pastFilterEndDate || undefined;
  const {
    transactions,
    allTransactions,
    isLoading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    restoreTransaction,
    countByCategoryMismatch,
    bulkUpdateCategory,
  } = useTransactions(pastQueryStartDate, pastQueryEndDate);

  // Averages cadence
  const [averageCadence, setAverageCadence] = useState<AverageCadence>('monthly');

  // Transaction dialog states
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [importWarningOpen, setImportWarningOpen] = useState(false);
  const [pendingImportSource, setPendingImportSource] = useState<'up' | 'csv'>('up');
  const [upImportOpen, setUpImportOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [importPopoverOpen, setImportPopoverOpen] = useState(false);
  const [bulkCategoryInfo, setBulkCategoryInfo] = useState<{
    description: string;
    categoryId: string;
    categoryName: string;
    matchingCount: number;
    transactionId: string;
  } | null>(null);

  // Shared filter states for transactions
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>(() => {
    const categoryParam = searchParams.get('category');
    return categoryParam ?? 'all';
  });

  const hasAnyTransactions = allTransactions.length > 0;

  // Track record calculations (historical averages)
  const trackRecord = useMemo(() => {
    if (allTransactions.length === 0) {
      return { income: 0, expenses: 0, savings: 0, net: 0 };
    }

    const { firstDateStr, lastDateStr } = firstAndLastDates(allTransactions);
    const firstDate = parseLocalDate(firstDateStr);
    const lastDate = parseLocalDate(lastDateStr);

    const daysDiff = daysBetween(firstDateStr, lastDateStr) + 1;

    let periods: number;
    switch (averageCadence) {
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
  }, [allTransactions, averageCadence]);

  // Get date range for track record display
  const transactionDateRange = useMemo(() => {
    if (allTransactions.length === 0) return null;
    const { firstDateStr, lastDateStr } = firstAndLastDates(allTransactions);
    return {
      from: formatDate(firstDateStr),
      to: formatDate(lastDateStr),
      count: allTransactions.length,
    };
  }, [allTransactions]);

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

  // Filtered data for transactions table
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

  // Get category name helper
  const getCategoryName = useCallback(
    (id: string | null) => (id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '—'),
    [categories],
  );

  // Transaction handlers
  const handleImportClick = useCallback(
    (source: 'up' | 'csv') => {
      if (categoryRules.length === 0) {
        setPendingImportSource(source);
        setImportWarningOpen(true);
      } else if (source === 'csv') {
        setCsvImportOpen(true);
      } else {
        setUpImportOpen(true);
      }
    },
    [categoryRules.length],
  );

  const handleSkipWarning = useCallback(() => {
    setImportWarningOpen(false);
    if (pendingImportSource === 'csv') {
      setCsvImportOpen(true);
    } else {
      setUpImportOpen(true);
    }
  }, [pendingImportSource]);

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
    async (id: string) => {
      const tx = allTransactions.find((t) => t.id === id);
      if (!tx) return;
      await deleteTransaction(id);
      toast('Transaction deleted', {
        action: {
          label: 'Undo',
          onClick: () => {
            restoreTransaction(tx);
          },
        },
        duration: 5000,
      });
    },
    [allTransactions, deleteTransaction, restoreTransaction],
  );

  const handleCategoryChanged = useCallback(
    async (info: { transactionId: string; description: string; newCategoryId: string }) => {
      const count = await countByCategoryMismatch(
        info.description,
        info.newCategoryId,
        info.transactionId,
      );
      if (count > 0) {
        const catName = categories.find((c) => c.id === info.newCategoryId)?.name ?? 'Unknown';
        setBulkCategoryInfo({
          description: info.description,
          categoryId: info.newCategoryId,
          categoryName: catName,
          matchingCount: count,
          transactionId: info.transactionId,
        });
      }
    },
    [countByCategoryMismatch, categories],
  );

  const handleBulkApply = useCallback(
    async (createRule: boolean) => {
      if (!bulkCategoryInfo) return;
      await bulkUpdateCategory(
        bulkCategoryInfo.description,
        bulkCategoryInfo.categoryId,
        bulkCategoryInfo.transactionId,
      );
      if (createRule) {
        await addRule({
          name: `Auto: ${bulkCategoryInfo.description}`,
          matchField: 'description',
          matchType: 'equals',
          matchValue: bulkCategoryInfo.description,
          categoryId: bulkCategoryInfo.categoryId,
          priority: getNextPriority(),
          enabled: true,
        });
      }
      setBulkCategoryInfo(null);
    },
    [bulkCategoryInfo, bulkUpdateCategory, addRule, getNextPriority],
  );

  // Transaction columns for DataTable
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
            <Link to={`/categories/${categoryId}?from=transactions`} className="hover:underline">
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

          return (
            <TooltipProvider>
              <div className="flex justify-end gap-1">
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
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTransaction(transaction.id)}
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
    [openEditTransactionDialog, handleDeleteTransaction, getCategoryName],
  );

  if (isLoading) {
    return null;
  }

  return (
    <div className="page-shell space-y-6">
      <div className="page-header flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <History className="h-5 w-5 text-slate-500" />
            </div>
            Transactions
          </h1>
          <p className="page-description">Review your transaction history</p>
        </div>
        {hasAnyTransactions && transactionDateRange && (
          <Select
            value={averageCadence}
            onValueChange={(v) => setAverageCadence(v as AverageCadence)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly average</SelectItem>
              <SelectItem value="fortnightly">Fortnightly average</SelectItem>
              <SelectItem value="monthly">Monthly average</SelectItem>
              <SelectItem value="quarterly">Quarterly average</SelectItem>
              <SelectItem value="yearly">Yearly average</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Track Record Summary */}
      {hasAnyTransactions && transactionDateRange && (
        <>
          {/* Hero - Average Net */}
          <div className="mb-4 min-h-28 text-center sm:min-h-32">
            <div className="flex min-h-8 items-center justify-center">
              <span className="flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400">
                <History className="h-3 w-3" />
                Historical
              </span>
            </div>
            <div className="mt-4">
              <p
                className={cn(
                  'flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide',
                  trackRecord.net >= 0 ? 'text-green-500' : 'text-amber-500',
                )}
              >
                <Banknote className="h-4 w-4" />
                Average Net
              </p>
              <p
                className={cn(
                  'mt-2 text-5xl font-bold tracking-tight',
                  trackRecord.net >= 0 ? 'text-green-500' : 'text-amber-500',
                )}
              >
                {trackRecord.net >= 0 ? '+' : ''}
                {formatCents(trackRecord.net)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Based on {transactionDateRange.count.toLocaleString()} transactions from{' '}
                {transactionDateRange.from} to {transactionDateRange.to}
              </p>
              <div className="mx-auto mt-4 mb-3 h-px w-24 bg-border" />
              <p className="invisible text-xs">placeholder</p>
            </div>
          </div>

          {/* Averages Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                  <BanknoteArrowUp className="h-4 w-4 text-green-500" />
                </div>
                <span className="text-sm text-muted-foreground">Average Income</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-green-600">
                {formatCents(trackRecord.income)}
              </p>
              <p className="text-xs text-muted-foreground">
                {FREQUENCY_PER_LABELS[averageCadence]}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
                  <BanknoteArrowDown className="h-4 w-4 text-red-500" />
                </div>
                <span className="text-sm text-muted-foreground">Average Expenses</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-red-600">
                {formatCents(trackRecord.expenses)}
              </p>
              <p className="text-xs text-muted-foreground">
                {FREQUENCY_PER_LABELS[averageCadence]}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10">
                  <PiggyBank className="h-4 w-4 text-blue-500" />
                </div>
                <span className="text-sm text-muted-foreground">Average Savings</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-blue-600">
                {formatCents(trackRecord.savings)}
              </p>
              <p className="text-xs text-muted-foreground">
                {FREQUENCY_PER_LABELS[averageCadence]}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Transactions */}
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between bg-card p-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <span className="font-medium">Past Transactions</span>
            {transactions.length > 0 && (
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
            )}
          </div>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/categories/import-rules?from=transactions">
                      <Settings2 className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Import Rules</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Popover open={importPopoverOpen} onOpenChange={setImportPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="secondary" size="sm">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Import</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="end">
                <button
                  type="button"
                  className="w-full cursor-pointer rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setImportPopoverOpen(false);
                    handleImportClick('csv');
                  }}
                >
                  Import from CSV
                </button>
                <button
                  type="button"
                  className="w-full cursor-pointer rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setImportPopoverOpen(false);
                    handleImportClick('up');
                  }}
                >
                  Import from Up Bank
                </button>
              </PopoverContent>
            </Popover>
            <Button size="sm" onClick={openAddTransactionDialog}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          </div>
        </div>
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
                  <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
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
      </div>

      {/* Transaction Dialogs */}
      <TransactionDialog
        open={transactionDialogOpen}
        onOpenChange={handleTransactionDialogClose}
        transaction={editingTransaction}
        addTransaction={addTransaction}
        updateTransaction={updateTransaction}
        onCategoryChanged={handleCategoryChanged}
        existingTransactions={allTransactions}
      />

      <UpImportDialog open={upImportOpen} onOpenChange={setUpImportOpen} />
      <CsvImportDialog open={csvImportOpen} onOpenChange={setCsvImportOpen} />

      <BulkCategoryDialog
        open={bulkCategoryInfo !== null}
        onOpenChange={(open) => {
          if (!open) setBulkCategoryInfo(null);
        }}
        description={bulkCategoryInfo?.description ?? ''}
        categoryName={bulkCategoryInfo?.categoryName ?? ''}
        matchingCount={bulkCategoryInfo?.matchingCount ?? 0}
        onApply={handleBulkApply}
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
