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
import { useScenarios } from '@/hooks/use-scenarios';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { formatCents, formatDate } from '@/lib/utils';
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

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No scenario selected</h2>
        <p className="text-muted-foreground">Select a scenario to view forecasts.</p>
      </div>
    );
  }

  const filteredForecasts = expandedForecasts
    .filter((f: ExpandedForecast) => filterType === 'all' || f.type === filterType)
    .sort((a: ExpandedForecast, b: ExpandedForecast) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

  const getCategoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-';

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

      {filteredForecasts.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No forecasts found.</p>
          <Button asChild className="mt-4">
            <Link to="/forecast/new">Add a one-off event</Link>
          </Button>
        </div>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredForecasts.map((forecast: ExpandedForecast, index: number) => (
              <TableRow key={`${forecast.sourceId}-${forecast.date}-${index}`}>
                <TableCell>{formatDate(forecast.date)}</TableCell>
                <TableCell className="font-medium">{forecast.description}</TableCell>
                <TableCell>
                  {forecast.type === 'income' ? (
                    <Badge variant="success">Income</Badge>
                  ) : forecast.type === 'savings' ? (
                    <Badge variant="info">Savings</Badge>
                  ) : (
                    <Badge variant="destructive">Expense</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {forecast.sourceType === 'rule' ? 'Recurring' : 'One-off'}
                  </Badge>
                </TableCell>
                <TableCell>{getCategoryName(forecast.categoryId)}</TableCell>
                <TableCell className="text-right font-mono">
                  <span
                    className={
                      forecast.type === 'income'
                        ? 'text-green-600'
                        : forecast.type === 'savings'
                          ? 'text-blue-600'
                          : 'text-red-600'
                    }
                  >
                    {forecast.type === 'income' ? '+' : '-'}
                    {formatCents(forecast.amountCents)}
                  </span>
                </TableCell>
                <TableCell>
                  {forecast.sourceType === 'event' && (
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/forecast/${forecast.sourceId}`}>Edit</Link>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
