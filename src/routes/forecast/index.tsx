import { useState, useMemo } from 'react';
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
import { useScenarios } from '@/hooks/use-scenarios';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { formatCents, formatDate, formatDateRange } from '@/lib/utils';
import type { ExpandedForecast } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

type FilterType = 'all' | 'income' | 'expense' | 'savings';

export function ForecastIndexPage() {
  const { activeScenarioId, startDate, endDate } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { expandedForecasts } = useForecasts(activeScenarioId, startDate, endDate);
  const { categories } = useCategories();

  const [filterType, setFilterType] = useState<FilterType>('all');

  const getCategoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-';

  const filteredForecasts = useMemo(
    () => expandedForecasts.filter((f) => filterType === 'all' || f.type === filterType),
    [expandedForecasts, filterType],
  );

  const columns: ColumnDef<ExpandedForecast>[] = useMemo(
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
          return <Badge variant="destructive">Expense</Badge>;
        },
      },
      {
        accessorKey: 'sourceType',
        header: 'Source',
        cell: ({ row }) => (
          <Badge variant="outline">
            {row.getValue('sourceType') === 'rule' ? 'Recurring' : 'One-off'}
          </Badge>
        ),
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
          const colorClass =
            type === 'income'
              ? 'text-green-600'
              : type === 'savings'
                ? 'text-blue-600'
                : 'text-red-600';
          return (
            <div className="text-right font-mono">
              <span className={colorClass}>
                {type === 'income' ? '+' : '-'}
                {formatCents(amount)}
              </span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) =>
          row.original.sourceType === 'event' ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/forecast/${row.original.sourceId}`}>Edit</Link>
            </Button>
          ) : null,
      },
    ],
    [categories],
  );

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No scenario selected</h2>
        <p className="text-muted-foreground">Select a scenario to view forecasts.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Forecast</h1>
          <p className="text-muted-foreground">
            Projected income, expenses, and savings for the period.
          </p>
        </div>
        <Button asChild>
          <Link to="/forecast/new">
            <Plus className="h-4 w-4" />
            Add One-off Event
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
      </div>

      {expandedForecasts.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No forecasts found between {formatDateRange(startDate, endDate)}.
          </p>
          <Button asChild className="mt-4">
            <Link to="/forecast/new">Add a one-off event</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          <DataTable
            columns={columns}
            data={filteredForecasts}
            searchKey="description"
            searchPlaceholder="Search forecasts..."
          />
        </div>
      )}
    </div>
  );
}
