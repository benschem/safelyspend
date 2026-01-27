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
import { usePeriods } from '@/hooks/use-periods';
import { useTransactions } from '@/hooks/use-transactions';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { formatCents, formatDate } from '@/lib/utils';

interface OutletContext {
  activePeriodId: string | null;
}

type FilterType = 'all' | 'income' | 'expense' | 'savings';

export function TransactionsIndexPage() {
  const { activePeriodId } = useOutletContext<OutletContext>();
  const { periods } = usePeriods();
  const activePeriod = periods.find((p) => p.id === activePeriodId) ?? null;
  const { transactions } = useTransactions(activePeriod);
  const { accounts } = useAccounts();
  const { categories } = useCategories();

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterAccountId, setFilterAccountId] = useState<string>('all');

  if (!activePeriodId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No period selected</h2>
        <p className="text-muted-foreground">Select a period to view transactions.</p>
      </div>
    );
  }

  const filteredTransactions = transactions
    .filter((t) => filterType === 'all' || t.type === filterType)
    .filter((t) => filterAccountId === 'all' || t.accountId === filterAccountId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getAccountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? 'Unknown';
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
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select value={filterAccountId} onValueChange={setFilterAccountId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No transactions found.</p>
          <Button asChild className="mt-4">
            <Link to="/transactions/new">Add your first transaction</Link>
          </Button>
        </div>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Account</TableHead>
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
                  ) : (
                    <Badge variant="destructive">Expense</Badge>
                  )}
                </TableCell>
                <TableCell>{getAccountName(transaction.accountId)}</TableCell>
                <TableCell>{getCategoryName(transaction.categoryId)}</TableCell>
                <TableCell className="text-right font-mono">
                  <span
                    className={
                      transaction.type === 'income'
                        ? 'text-green-600'
                        : transaction.type === 'savings'
                          ? 'text-blue-600'
                          : 'text-red-600'
                    }
                  >
                    {transaction.type === 'income' ? '+' : '-'}
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
