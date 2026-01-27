import { useMemo } from 'react';
import { useOutletContext, Link } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus } from 'lucide-react';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';
import { formatCents, formatDate, formatDateRange } from '@/lib/utils';
import type { Transaction } from '@/lib/types';
import { useState } from 'react';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

type FilterType = 'all' | 'income' | 'expense' | 'savings' | 'adjustment';

export function TransactionsIndexPage() {
  const { startDate, endDate } = useOutletContext<OutletContext>();
  const { transactions } = useTransactions(startDate, endDate);
  const { categories } = useCategories();

  const [filterType, setFilterType] = useState<FilterType>('all');

  const getCategoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-';

  const filteredTransactions = useMemo(
    () => transactions.filter((t) => filterType === 'all' || t.type === filterType),
    [transactions, filterType],
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
        cell: ({ row }) => (
          <span className="font-medium">{row.getValue('description')}</span>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => {
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
        cell: ({ row }) => getCategoryName(row.getValue('categoryId')),
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
        cell: ({ row }) => (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/transactions/${row.original.id}`}>View</Link>
          </Button>
        ),
      },
    ],
    [categories],
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">Actual income, expenses, and savings.</p>
        </div>
        <Button asChild>
          <Link to="/transactions/new">
            <Plus className="h-4 w-4" />
            Add Transaction
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex gap-4">
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
