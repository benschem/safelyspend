import { useState, useMemo, useCallback } from 'react';
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
import { Plus, Repeat, Settings2 } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { DateFilter } from '@/components/date-filter';
import { formatCents, formatDate, getCurrentFinancialYear } from '@/lib/utils';
import type { ExpandedForecast } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
}

type FilterType = 'all' | 'income' | 'expense' | 'savings';

export function ForecastIndexPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { categories } = useCategories();

  // Default to current financial year for forecast expansion
  const defaultRange = getCurrentFinancialYear();
  const [filterStartDate, setFilterStartDate] = useState(defaultRange.startDate);
  const [filterEndDate, setFilterEndDate] = useState(defaultRange.endDate);

  const hasCustomDateFilter =
    filterStartDate !== defaultRange.startDate || filterEndDate !== defaultRange.endDate;

  const clearDateFilter = useCallback(() => {
    setFilterStartDate(defaultRange.startDate);
    setFilterEndDate(defaultRange.endDate);
  }, [defaultRange.startDate, defaultRange.endDate]);

  const { expandedForecasts } = useForecasts(activeScenarioId, filterStartDate, filterEndDate);

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
        cell: ({ row }) => {
          const forecast = row.original;
          const linkTo =
            forecast.sourceType === 'rule'
              ? `/forecasts/recurring/${forecast.sourceId}`
              : `/forecasts/${forecast.sourceId}`;
          return (
            <Link to={linkTo} className="font-medium hover:underline">
              {row.getValue('description')}
            </Link>
          );
        },
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
        cell: ({ row }) => {
          const isRecurring = row.getValue('sourceType') === 'rule';
          return (
            <Badge variant="outline" className="gap-1">
              {isRecurring && <Repeat className="h-3 w-3" />}
              {isRecurring ? 'Recurring' : 'One-time'}
            </Badge>
          );
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
        cell: ({ row }) => {
          const forecast = row.original;
          const linkTo =
            forecast.sourceType === 'rule'
              ? `/forecasts/recurring/${forecast.sourceId}`
              : `/forecasts/${forecast.sourceId}`;
          return (
            <Button variant="outline" size="sm" asChild>
              <Link to={linkTo}>Edit</Link>
            </Button>
          );
        },
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Forecasts</h1>
          <p className="text-muted-foreground">
            Projected income, expenses, and savings for the period.
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button asChild variant="outline" className="flex-1 sm:flex-none">
            <Link to="/forecasts/new">
              <Plus className="h-4 w-4" />
              One-Time
            </Link>
          </Button>
          <Button asChild className="flex-1 sm:flex-none">
            <Link to="/forecasts/recurring/new">
              <Repeat className="h-4 w-4" />
              Recurring
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <DateFilter
            startDate={filterStartDate}
            endDate={filterEndDate}
            onStartDateChange={setFilterStartDate}
            onEndDateChange={setFilterEndDate}
            onClear={clearDateFilter}
            hasFilter={hasCustomDateFilter}
          />
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
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link to="/forecasts/recurring">
            <Settings2 className="h-4 w-4" />
            Manage Recurring
          </Link>
        </Button>
      </div>

      {expandedForecasts.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No forecasts found in the selected date range.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link to="/forecasts/new">Add one-time event</Link>
            </Button>
            <Button asChild>
              <Link to="/forecasts/recurring/new">Add recurring</Link>
            </Button>
          </div>
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
