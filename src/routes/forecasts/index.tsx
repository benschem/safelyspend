import { useState, useMemo, useCallback } from 'react';
import { useOutletContext, Link } from 'react-router';
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
import { formatCents, formatDate, getCurrentFinancialYear, today as getToday } from '@/lib/utils';
import type { ExpandedForecast } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
}

type FilterType = 'all' | 'income' | 'expense' | 'savings';

export function ForecastIndexPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { categories } = useCategories();

  // Default to today through end of financial year for forecasts
  const financialYear = getCurrentFinancialYear();
  const todayDate = getToday();
  const [filterStartDate, setFilterStartDate] = useState(todayDate);
  const [filterEndDate, setFilterEndDate] = useState(financialYear.endDate);

  const hasCustomDateFilter =
    filterStartDate !== todayDate || filterEndDate !== financialYear.endDate;

  const clearDateFilter = useCallback(() => {
    setFilterStartDate(todayDate);
    setFilterEndDate(financialYear.endDate);
  }, [todayDate, financialYear.endDate]);

  const { expandedForecasts } = useForecasts(activeScenarioId, filterStartDate, filterEndDate);

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);

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

      {expandedForecasts.length === 0 ? (
        <div className="mt-6 space-y-4">
          <Alert variant="info">
            Forecasts predict your future cash flow based on recurring income and expenses.
            Add your salary, rent, subscriptions, and other regular payments to see what&apos;s coming.
          </Alert>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground">
              No forecasts found in the selected date range.
            </p>
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
                hasFilter={hasCustomDateFilter}
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
