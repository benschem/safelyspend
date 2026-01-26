import { useState } from 'react';
import { useParams, Link, useNavigate, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { formatCents, formatDate, parseCentsFromInput } from '@/lib/utils';

interface OutletContext {
  activePeriodId: string | null;
}

export function ForecastDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activePeriodId } = useOutletContext<OutletContext>();
  const { forecasts, updateForecast, deleteForecast } = useForecasts(activePeriodId);
  const { categories, activeCategories } = useCategories();

  const forecast = forecasts.find((f) => f.id === id);

  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>(forecast?.type ?? 'expense');
  const [date, setDate] = useState(forecast?.date ?? '');
  const [description, setDescription] = useState(forecast?.description ?? '');
  const [amount, setAmount] = useState(forecast ? (forecast.amountCents / 100).toFixed(2) : '');
  const [categoryId, setCategoryId] = useState(forecast?.categoryId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!forecast) {
    return (
      <div>
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/forecast">
              <ArrowLeft className="h-4 w-4" />
              Back to Forecasts
            </Link>
          </Button>
        </div>
        <p className="text-muted-foreground">Forecast not found.</p>
      </div>
    );
  }

  const getCategoryName = (catId: string | null) =>
    catId ? (categories.find((c) => c.id === catId)?.name ?? 'Unknown') : '-';

  const handleSave = () => {
    setError(null);

    if (!date) {
      setError('Date is required');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (!amount || parseCentsFromInput(amount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    updateForecast(forecast.id, {
      type,
      date,
      description: description.trim(),
      amountCents: parseCentsFromInput(amount),
      categoryId: categoryId || null,
    });
    setEditing(false);
  };

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteForecast(forecast.id);
    navigate('/forecast');
  };

  const startEditing = () => {
    setType(forecast.type);
    setDate(forecast.date);
    setDescription(forecast.description);
    setAmount((forecast.amountCents / 100).toFixed(2));
    setCategoryId(forecast.categoryId ?? '');
    setEditing(true);
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/forecast">
            <ArrowLeft className="h-4 w-4" />
            Back to Forecasts
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{forecast.description}</h1>
            {forecast.type === 'income' ? (
              <Badge variant="success">Income</Badge>
            ) : (
              <Badge variant="destructive">Expense</Badge>
            )}
          </div>
          <p className="text-muted-foreground">{formatDate(forecast.date)}</p>
        </div>
        <div
          className={`text-2xl font-bold ${
            forecast.type === 'income' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {forecast.type === 'income' ? '+' : '-'}
          {formatCents(forecast.amountCents)}
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      <Separator className="my-6" />

      {/* Edit Section */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Forecast Details</h2>
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              Edit
            </Button>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v as 'income' | 'expense')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="expense" id="expense" />
                  <Label htmlFor="expense" className="font-normal">
                    Expense
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="income" id="income" />
                  <Label htmlFor="income" className="font-normal">
                    Income
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={categoryId || '__none__'}
                onValueChange={(v) => setCategoryId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {activeCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave}>Save</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Type:</span>{' '}
              {forecast.type === 'income' ? 'Income' : 'Expense'}
            </p>
            <p>
              <span className="text-muted-foreground">Date:</span> {formatDate(forecast.date)}
            </p>
            <p>
              <span className="text-muted-foreground">Description:</span> {forecast.description}
            </p>
            <p>
              <span className="text-muted-foreground">Amount:</span>{' '}
              {formatCents(forecast.amountCents)}
            </p>
            <p>
              <span className="text-muted-foreground">Category:</span>{' '}
              {getCategoryName(forecast.categoryId)}
            </p>
          </div>
        )}
      </section>

      <Separator className="my-6" />

      {/* Danger Zone */}
      <section>
        <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
        <div className="mt-4 rounded-lg border border-destructive/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Delete Forecast</h3>
              <p className="text-sm text-muted-foreground">Permanently delete this forecast.</p>
            </div>
            <div className="flex gap-2">
              {confirmingDelete && (
                <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
              )}
              <Button variant="destructive" onClick={handleDelete}>
                {confirmingDelete ? 'Confirm Delete' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
