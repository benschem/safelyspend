import { useState, useMemo, useCallback } from 'react';
import { useOutletContext, Link, useSearchParams } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus, Repeat, Settings2, Pencil, Telescope } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { ScenarioSelector } from '@/components/scenario-selector';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { DateRangeFilter } from '@/components/date-range-filter';
import { ForecastEventDialog } from '@/components/dialogs/forecast-event-dialog';
import { ForecastRuleDialog } from '@/components/dialogs/forecast-rule-dialog';
import { formatCents, formatDate } from '@/lib/utils';
import type { ExpandedForecast } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
}

type FilterType = 'all' | 'income' | 'expense' | 'savings';
type CategoryFilter = 'all' | string;

export function ForecastIndexPage() {
  const [searchParams] = useSearchParams();
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { categories, activeCategories } = useCategories();

  // Date filter - empty by default (shows all)
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Has filter if either date is set
  const hasDateFilter = filterStartDate !== '' || filterEndDate !== '';

  const clearDateFilter = useCallback(() => {
    setFilterStartDate('');
    setFilterEndDate('');
  }, []);

  // Use wide defaults for unset dates (partial filter support)
  const defaultStart = '2020-01-01';
  const defaultEnd = '2099-12-31';
  const queryStartDate = filterStartDate || defaultStart;
  const queryEndDate = filterEndDate || defaultEnd;

  const { expandedForecasts, rules, events } = useForecasts(activeScenarioId, queryStartDate, queryEndDate);

  // Check if any forecasts exist at all (rules or events)
  const hasAnyForecasts = rules.length > 0 || events.length > 0;

  const [filterType, setFilterType] = useState<FilterType>('all');
  // Initialize category filter from URL param if present
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>(() => {
    const categoryParam = searchParams.get('category');
    return categoryParam ?? 'all';
  });
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);

  const getCategoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-';

  const filteredForecasts = useMemo(
    () => expandedForecasts.filter((f) => {
      if (filterType !== 'all' && f.type !== filterType) return false;
      if (filterCategory !== 'all' && f.categoryId !== filterCategory) return false;
      return true;
    }),
    [expandedForecasts, filterType, filterCategory],
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
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" asChild title="Edit">
                <Link to={linkTo}>
                  <Pencil className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          );
        },
      },
    ],
    [categories],
  );

  if (!activeScenarioId || !activeScenario) {
    return (
      <div>
        <div className="mb-20">
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Telescope className="h-7 w-7" />
            Forecasts
          </h1>
          <p className="mt-1 text-muted-foreground">
            Projected income, expenses, and savings for a scenario.
          </p>
        </div>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Select a scenario to view forecasts.</p>
          <Button asChild className="mt-4">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-20 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Telescope className="h-7 w-7" />
            Forecasts
          </h1>
          <p className="mt-1 text-muted-foreground">
            Projected income, expenses, and savings for {activeScenario.name}.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEventDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add One-Time
            </Button>
            <Button onClick={() => setRuleDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Recurring
            </Button>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/forecasts/recurring">
              <Settings2 className="h-4 w-4" />
              Manage Recurring
            </Link>
          </Button>
        </div>
      </div>

      {!hasAnyForecasts ? (
        <div className="mt-6 space-y-4">
          <Alert variant="info">
            Add your salary, rent, subscriptions, and other regular income and expenses to predict future cash flow.
          </Alert>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground">No forecasts yet.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" onClick={() => setEventDialogOpen(true)}>
                Add one-time event
              </Button>
              <Button onClick={() => setRuleDialogOpen(true)}>
                Add recurring
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <DataTable
          emptyMessage="No forecasts found matching your filters."
          columns={columns}
          data={filteredForecasts}
          searchKey="description"
          searchPlaceholder="Search forecasts..."
          filterSlot={
            <>
              <DateRangeFilter
                startDate={filterStartDate}
                endDate={filterEndDate}
                onStartDateChange={setFilterStartDate}
                onEndDateChange={setFilterEndDate}
                onClear={clearDateFilter}
                hasFilter={hasDateFilter}
              />
              <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {activeCategories
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <ScenarioSelector hideLabel />
            </>
          }
        />
      )}

      <ForecastEventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        scenarioId={activeScenarioId}
        event={null}
      />

      <ForecastRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        scenarioId={activeScenarioId}
        rule={null}
      />
    </div>
  );
}
