import { Link } from 'react-router';
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
import { Plus } from 'lucide-react';
import { useRecurringItems } from '@/hooks/use-recurring-items';
import { useCategories } from '@/hooks/use-categories';
import { formatCents } from '@/lib/utils';

const frequencyLabels: Record<string, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const dayOfWeekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function RecurringIndexPage() {
  const { recurringItems } = useRecurringItems();
  const { categories } = useCategories();

  const getCategoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-';

  const getScheduleDescription = (item: (typeof recurringItems)[0]) => {
    const freq = frequencyLabels[item.frequency] || item.frequency;
    if (item.frequency === 'weekly' || item.frequency === 'fortnightly') {
      const day = dayOfWeekLabels[item.dayOfWeek ?? 0];
      return `${freq} on ${day}`;
    }
    if (item.dayOfMonth) {
      const suffix =
        item.dayOfMonth === 1 || item.dayOfMonth === 21 || item.dayOfMonth === 31
          ? 'st'
          : item.dayOfMonth === 2 || item.dayOfMonth === 22
            ? 'nd'
            : item.dayOfMonth === 3 || item.dayOfMonth === 23
              ? 'rd'
              : 'th';
      return `${freq} on the ${item.dayOfMonth}${suffix}`;
    }
    return freq;
  };

  const activeItems = recurringItems.filter((i) => i.isActive);
  const inactiveItems = recurringItems.filter((i) => !i.isActive);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recurring Items</h1>
          <p className="text-muted-foreground">Templates for regular income and expenses.</p>
        </div>
        <Button asChild>
          <Link to="/manage/recurring/new">
            <Plus className="h-4 w-4" />
            Add Recurring
          </Link>
        </Button>
      </div>

      {recurringItems.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No recurring items yet.</p>
          <Button asChild className="mt-4">
            <Link to="/manage/recurring/new">Add your first recurring item</Link>
          </Button>
        </div>
      ) : (
        <>
          {activeItems.length > 0 && (
            <Table className="mt-6">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      {item.type === 'income' ? (
                        <Badge variant="success">Income</Badge>
                      ) : (
                        <Badge variant="destructive">Expense</Badge>
                      )}
                    </TableCell>
                    <TableCell>{getScheduleDescription(item)}</TableCell>
                    <TableCell>{getCategoryName(item.categoryId)}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={item.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                        {item.type === 'income' ? '+' : '-'}
                        {formatCents(item.amountCents)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/manage/recurring/${item.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {inactiveItems.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold text-muted-foreground">
                Paused ({inactiveItems.length})
              </h2>
              <Table className="mt-2">
                <TableBody>
                  {inactiveItems.map((item) => (
                    <TableRow key={item.id} className="opacity-60">
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        {item.type === 'income' ? (
                          <Badge variant="outline">Income</Badge>
                        ) : (
                          <Badge variant="outline">Expense</Badge>
                        )}
                      </TableCell>
                      <TableCell>{getScheduleDescription(item)}</TableCell>
                      <TableCell>{getCategoryName(item.categoryId)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCents(item.amountCents)}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/manage/recurring/${item.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </>
      )}
    </div>
  );
}
