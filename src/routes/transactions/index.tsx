import { useMemo, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
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
import { Plus, Pencil, Trash2, Download, AlertTriangle, Receipt, RotateCcw, TrendingUp, TrendingDown, PiggyBank, ArrowLeftRight, Settings2, ChevronUp, ChevronDown } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';
import { useCategoryRules } from '@/hooks/use-category-rules';
import { DateRangeFilter } from '@/components/date-range-filter';
import { TransactionDialog } from '@/components/dialogs/transaction-dialog';
import { UpImportDialog } from '@/components/up-import-dialog';
import { formatCents, formatDate, today as getToday } from '@/lib/utils';
import type { Transaction } from '@/lib/types';

type FilterType = 'all' | 'income' | 'expense' | 'savings' | 'adjustment';
type CategoryFilter = 'all' | 'uncategorized' | string;

// Default: no start date, end at today (past transactions)
const getDefaultStartDate = () => '';
const getDefaultEndDate = () => getToday();

export function TransactionsIndexPage() {
  const [searchParams] = useSearchParams();

  // Date filter state - defaults to past transactions (up to today)
  const [filterStartDate, setFilterStartDate] = useState(getDefaultStartDate);
  const [filterEndDate, setFilterEndDate] = useState(getDefaultEndDate);

  // Has non-default filter
  const hasDateFilter = filterStartDate !== getDefaultStartDate() || filterEndDate !== getDefaultEndDate();

  // Pass dates to hook (supports partial ranges: from-only, to-only, or both)
  const queryStartDate = filterStartDate || undefined;
  const queryEndDate = filterEndDate || undefined;

  const { transactions, allTransactions, isLoading: transactionsLoading, addTransaction, updateTransaction, deleteTransaction } = useTransactions(queryStartDate, queryEndDate);
  const { categories, activeCategories, isLoading: categoriesLoading } = useCategories();
  const { rules: categoryRules } = useCategoryRules();

  // Combined loading state from all data hooks
  const isLoading = transactionsLoading || categoriesLoading;

  // Check if any transactions exist at all
  const hasAnyTransactions = allTransactions.length > 0;

  const [filterType, setFilterType] = useState<FilterType>('all');
  // Initialize category filter from URL param if present
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>(() => {
    const categoryParam = searchParams.get('category');
    return categoryParam ?? 'all';
  });

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Import dialog state
  const [importWarningOpen, setImportWarningOpen] = useState(false);
  const [upImportOpen, setUpImportOpen] = useState(false);

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const resetFilters = useCallback(() => {
    setFilterStartDate(getDefaultStartDate());
    setFilterEndDate(getDefaultEndDate());
  }, []);

  const getCategoryName = useCallback(
    (id: string | null) => (id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-'),
    [categories],
  );

  const openAddDialog = useCallback(() => {
    setEditingTransaction(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingTransaction(null);
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (deletingId === id) {
      deleteTransaction(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
    }
  }, [deletingId, deleteTransaction]);

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        // Type filter
        if (filterType !== 'all' && t.type !== filterType) return false;
        // Category filter
        if (filterCategory === 'uncategorized' && t.categoryId !== null) return false;
        if (filterCategory !== 'all' && filterCategory !== 'uncategorized' && t.categoryId !== filterCategory) return false;
        return true;
      }),
    [transactions, filterType, filterCategory],
  );

  const columns: ColumnDef<Transaction>[] = useMemo(
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
                      onClick={() => openEditDialog(transaction)}
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
              onClick={() => openEditDialog(transaction)}
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

          // Other types: income/adjustment positive, expense negative
          const isPositive = type === 'income' || type === 'adjustment';
          const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
          return (
            <div className="text-right font-mono">
              <span className={colorClass}>
                {isPositive ? '+' : '-'}
                {formatCents(amount)}
              </span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const transaction = row.original;
          const isDeleting = deletingId === transaction.id;

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(transaction)}
                aria-label="Edit transaction"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant={isDeleting ? 'destructive' : 'ghost'}
                size="sm"
                onClick={() => handleDelete(transaction.id)}
                onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                aria-label={isDeleting ? 'Confirm delete' : 'Delete transaction'}
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

  return (
    <div className="page-shell">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <Receipt className="h-5 w-5 text-slate-500" />
            </div>
            Transactions
          </h1>
          <p className="page-description">Actual income, expenses, and savings.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleImportClick}>
              <Download className="h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4" />
              Add Transaction
            </Button>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/categories/import-rules?from=transactions">
              <Settings2 className="h-4 w-4" />
              Import Rules
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <PageLoading />
      ) : !hasAnyTransactions ? (
        <div className="space-y-4">
          <Alert variant="info">
            Record transactions here to track your spending against your budget and see your real financial position.
          </Alert>
          <div className="empty-state">
            <p className="empty-state-text">No transactions yet.</p>
            <Button onClick={openAddDialog} className="empty-state-action">
              Add a transaction
            </Button>
          </div>
        </div>
      ) : (
        <DataTable
          emptyMessage="No transactions found matching your filters."
          columns={columns}
          data={filteredTransactions}
          searchKey="description"
          searchPlaceholder="Search transactions..."
          initialSorting={[{ id: 'date', desc: true }]}
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
              {hasDateFilter && (
                <Button variant="ghost" size="sm" onClick={resetFilters} title="Reset to defaults">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </>
          }
        />
      )}

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        transaction={editingTransaction}
        addTransaction={addTransaction}
        updateTransaction={updateTransaction}
      />

      <UpImportDialog open={upImportOpen} onOpenChange={setUpImportOpen} />

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
    </div>
  );
}
