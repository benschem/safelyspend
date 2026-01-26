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
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { formatCents, formatDate } from '@/lib/utils';

interface OutletContext {
  activePeriodId: string | null;
}

type FilterType = 'all' | 'income' | 'expense';

export function ForecastIndexPage() {
  const { activePeriodId } = useOutletContext<OutletContext>();
  const { forecasts } = useForecasts(activePeriodId);
  const { categories } = useCategories();

  const [filterType, setFilterType] = useState<FilterType>('all');

  if (!activePeriodId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No period selected</h2>
        <p className="text-muted-foreground">Select a period to view forecasts.</p>
      </div>
    );
  }

  const filteredForecasts = forecasts
    .filter((f) => filterType === 'all' || f.type === filterType)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const getCategoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-';

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Forecast</h1>
          <p className="text-muted-foreground">Projected income and expenses for the period.</p>
        </div>
        <Button asChild>
          <Link to="/forecast/new">
            <Plus className="h-4 w-4" />
            Add Forecast
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
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredForecasts.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No forecasts found.</p>
          <Button asChild className="mt-4">
            <Link to="/forecast/new">Add your first forecast</Link>
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
            {filteredForecasts.map((forecast) => (
              <TableRow key={forecast.id}>
                <TableCell>{formatDate(forecast.date)}</TableCell>
                <TableCell className="font-medium">{forecast.description}</TableCell>
                <TableCell>
                  {forecast.type === 'income' ? (
                    <Badge variant="success">Income</Badge>
                  ) : (
                    <Badge variant="destructive">Expense</Badge>
                  )}
                </TableCell>
                <TableCell>{getCategoryName(forecast.categoryId)}</TableCell>
                <TableCell className="text-right font-mono">
                  <span className={forecast.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                    {forecast.type === 'income' ? '+' : '-'}
                    {formatCents(forecast.amountCents)}
                  </span>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/forecast/${forecast.id}`}>View</Link>
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
