import { useMemo, useState, useCallback, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router';
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
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';
import { CategorySelect } from '@/components/category-select';
import { formatCents, formatDate, formatDateRange, parseCentsFromInput } from '@/lib/utils';
import type { Transaction, TransactionType } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

type FilterType = 'all' | 'income' | 'expense' | 'savings' | 'adjustment';
type CategoryFilter = 'all' | 'uncategorized' | string;

export function TransactionsIndexPage() {
  const { startDate, endDate } = useOutletContext<OutletContext>();
  const { transactions, updateTransaction, deleteTransaction } = useTransactions(startDate, endDate);
  const { categories, activeCategories } = useCategories();

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>('all');

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<TransactionType>('expense');
  const [editCategory, setEditCategory] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        <Button asChild className="w-full sm:w-auto">
          <Link to="/transactions/new">
            <Plus className="h-4 w-4" />
            Add Transaction
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-4">
        <div className="w-40">
          <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
            <SelectTrigger>
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
        </div>
        <div className="w-48">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger>
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
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No transactions found between {formatDateRange(startDate, endDate)}.
          </p>
          <Button asChild className="mt-4">
            <Link to="/transactions/new">Add a transaction</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          <DataTable
            columns={columns}
            data={filteredTransactions}
            searchKey="description"
            searchPlaceholder="Search transactions..."
          />
        </div>
      )}
    </div>
  );
}
