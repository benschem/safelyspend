import { useMemo, useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Plus, Pencil, Trash2, Check, X, Upload, AlertTriangle } from 'lucide-react';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';
import { useCategoryRules } from '@/hooks/use-category-rules';
import { CategorySelect } from '@/components/category-select';
import { DateFilter } from '@/components/date-filter';
import { TransactionDialog } from '@/components/dialogs/transaction-dialog';
import { UpImportDialog } from '@/components/up-import-dialog';
import { formatCents, formatDate, parseCentsFromInput } from '@/lib/utils';
import type { Transaction, TransactionType } from '@/lib/types';

type FilterType = 'all' | 'income' | 'expense' | 'savings' | 'adjustment';
type CategoryFilter = 'all' | 'uncategorized' | string;

export function TransactionsIndexPage() {
  // Date filter state - empty strings mean no filter
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const hasDateFilter = filterStartDate !== '' || filterEndDate !== '';

  // Pass dates to hook only if both are set, otherwise get all transactions
  const queryStartDate = filterStartDate && filterEndDate ? filterStartDate : undefined;
  const queryEndDate = filterStartDate && filterEndDate ? filterEndDate : undefined;

  const { transactions, updateTransaction, deleteTransaction } = useTransactions(queryStartDate, queryEndDate);
  const { categories, activeCategories } = useCategories();
  const { rules: categoryRules } = useCategoryRules();

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>('all');

  // Add dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Import dialog state
  const [importWarningOpen, setImportWarningOpen] = useState(false);
  const [upImportOpen, setUpImportOpen] = useState(false);

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

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<TransactionType>('expense');
  const [editCategory, setEditCategory] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const clearDateFilter = useCallback(() => {
    setFilterStartDate('');
    setFilterEndDate('');
  }, []);

  const getCategoryName = useCallback(
    (id: string | null) => (id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-'),
    [categories],
  );

  const startEditing = useCallback((transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditDate(transaction.date);
    setEditDescription(transaction.description);
    setEditType(transaction.type);
    setEditCategory(transaction.categoryId ?? '');
    setEditAmount((transaction.amountCents / 100).toFixed(2));
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditDate('');
    setEditDescription('');
    setEditType('expense');
    setEditCategory('');
    setEditAmount('');
  }, []);

  const saveEditing = useCallback(() => {
    if (!editingId || !editDescription.trim() || !editDate) return;

    const amountCents = parseCentsFromInput(editAmount);
    if (amountCents <= 0) return;

    updateTransaction(editingId, {
      date: editDate,
      description: editDescription.trim(),
      type: editType,
      categoryId: editCategory || null,
      amountCents,
    });
    cancelEditing();
  }, [editingId, editDate, editDescription, editType, editCategory, editAmount, updateTransaction, cancelEditing]);

  const handleDelete = useCallback((id: string) => {
    if (deletingId === id) {
      deleteTransaction(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
    }
  }, [deletingId, deleteTransaction]);

  // Close editors on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) cancelEditing();
        if (deletingId) setDeletingId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingId, deletingId, cancelEditing]);

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
        cell: ({ row }) => {
          const transaction = row.original;
          if (editingId === transaction.id) {
            return (
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="h-8 w-32"
              />
            );
          }
          return formatDate(row.getValue('date'));
        },
        sortingFn: 'datetime',
      },
      {
        accessorKey: 'description',
        header: ({ column }) => <SortableHeader column={column}>Description</SortableHeader>,
        cell: ({ row }) => {
          const transaction = row.original;
          if (editingId === transaction.id) {
            return (
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="h-8 w-full min-w-[120px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEditing();
                  if (e.key === 'Escape') cancelEditing();
                }}
              />
            );
          }
          return (
            <Link
              to={`/transactions/${transaction.id}`}
              className="font-medium hover:underline"
            >
              {row.getValue('description')}
            </Link>
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
          const transaction = row.original;
          if (editingId === transaction.id) {
            return (
              <Select value={editType} onValueChange={(v) => setEditType(v as TransactionType)}>
                <SelectTrigger className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            );
          }
          const type = row.getValue('type') as string;
          if (type === 'income') return <Badge variant="success">Income</Badge>;
          if (type === 'savings') return <Badge variant="info">Savings</Badge>;
          if (type === 'adjustment') return <Badge variant="secondary">Adjustment</Badge>;
          return <Badge variant="destructive">Expense</Badge>;
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
          const transaction = row.original;
          if (editingId === transaction.id) {
            return (
              <div className="min-w-[140px]">
                <CategorySelect
                  value={editCategory}
                  onChange={setEditCategory}
                  allowNone
                />
              </div>
            );
          }
          return getCategoryName(transaction.categoryId);
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
          if (editingId === transaction.id) {
            return (
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="h-8 w-24 text-right"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEditing();
                  if (e.key === 'Escape') cancelEditing();
                }}
              />
            );
          }
          const type = transaction.type;
          const amount = row.getValue('amountCents') as number;
          const isPositive = type === 'income' || type === 'adjustment';
          const colorClass =
            type === 'income' || type === 'adjustment'
              ? 'text-green-600'
              : type === 'savings'
                ? 'text-blue-600'
                : 'text-red-600';
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
          const isEditing = editingId === transaction.id;
          const isDeleting = deletingId === transaction.id;

          if (isEditing) {
            return (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={saveEditing} title="Save">
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={cancelEditing} title="Cancel">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          }

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditing(transaction)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant={isDeleting ? 'destructive' : 'ghost'}
                size="sm"
                onClick={() => handleDelete(transaction.id)}
                onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                title={isDeleting ? 'Click again to confirm' : 'Delete'}
              >
                {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        },
      },
    ],
    [categories, editingId, editDate, editDescription, editType, editCategory, editAmount, deletingId, startEditing, cancelEditing, saveEditing, handleDelete, getCategoryName],
  );

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">Actual income, expenses, and savings.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="secondary" onClick={handleImportClick} className="flex-1 sm:flex-none">
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setAddDialogOpen(true)} className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Date filter */}
      <div className="mt-6">
        <DateFilter
          startDate={filterStartDate}
          endDate={filterEndDate}
          onStartDateChange={setFilterStartDate}
          onEndDateChange={setFilterEndDate}
          onClear={clearDateFilter}
          hasFilter={hasDateFilter}
        />
      </div>

      {transactions.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            {hasDateFilter ? 'No transactions found in the selected date range.' : 'No transactions yet.'}
          </p>
          <Button onClick={() => setAddDialogOpen(true)} className="mt-4">
            Add a transaction
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          <DataTable
            columns={columns}
            data={filteredTransactions}
            searchKey="description"
            searchPlaceholder="Search transactions..."
            filterSlot={
              <>
                <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
                  <SelectTrigger className="w-36">
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
                  <SelectTrigger className="w-44">
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
              </>
            }
          />
        </div>
      )}

      <TransactionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        transaction={null}
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
