import { useState } from 'react';
import { useOutletContext, Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';
import { formatCents, formatDate, formatDateRange } from '@/lib/utils';

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

  const filteredTransactions = transactions
    .filter((t) => filterType === 'all' || t.type === filterType)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getCategoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-';

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

      {filteredTransactions.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No transactions found between {formatDateRange(startDate, endDate)}.
          </p>
          <Button asChild className="mt-4">
            <Link to="/transactions/new">Add a transaction</Link>
          </Button>
        </div>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{formatDate(transaction.date)}</TableCell>
                <TableCell className="font-medium">{transaction.description}</TableCell>
                <TableCell>
                  {transaction.type === 'income' ? (
                    <Badge variant="success">Income</Badge>
                  ) : transaction.type === 'savings' ? (
                    <Badge variant="info">Savings</Badge>
                  ) : transaction.type === 'adjustment' ? (
                    <Badge variant="secondary">Adjustment</Badge>
                  ) : (
                    <Badge variant="destructive">Expense</Badge>
                  )}
                </TableCell>
                <TableCell>{getCategoryName(transaction.categoryId)}</TableCell>
                <TableCell className="text-right font-mono">
                  <span
                    className={
                      transaction.type === 'income' || transaction.type === 'adjustment'
                        ? 'text-green-600'
                        : transaction.type === 'savings'
                          ? 'text-blue-600'
                          : 'text-red-600'
                    }
                  >
                    {transaction.type === 'income' || transaction.type === 'adjustment' ? '+' : '-'}
                    {formatCents(transaction.amountCents)}
                  </span>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/transactions/${transaction.id}`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
