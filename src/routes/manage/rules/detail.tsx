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
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { formatCents, parseCentsFromInput } from '@/lib/utils';
import type { ForecastType, Cadence } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

const CADENCE_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function RuleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { rules, updateRule, deleteRule } = useForecasts(activeScenarioId);
  const { categories, activeCategories } = useCategories();
  const { savingsGoals } = useSavingsGoals();

  const rule = rules.find((r) => r.id === id);

  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<ForecastType>(rule?.type ?? 'expense');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [amount, setAmount] = useState(rule ? (rule.amountCents / 100).toFixed(2) : '');
  const [cadence, setCadence] = useState<Cadence>(rule?.cadence ?? 'monthly');
  const [dayOfMonth, setDayOfMonth] = useState(String(rule?.dayOfMonth ?? 1));
  const [dayOfWeek, setDayOfWeek] = useState(String(rule?.dayOfWeek ?? 0));
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? '');
  const [savingsGoalId, setSavingsGoalId] = useState(rule?.savingsGoalId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!rule) {
    return (
      <div>
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/manage/rules">
              <ArrowLeft className="h-4 w-4" />
              Back to Forecast Rules
            </Link>
          </Button>
        </div>
        <p className="text-muted-foreground">Forecast rule not found.</p>
      </div>
    );
  }

  const getCategoryName = (catId: string | null) =>
    catId ? (categories.find((c) => c.id === catId)?.name ?? 'Unknown') : '-';
  const getSavingsGoalName = (goalId: string | null) =>
    goalId ? (savingsGoals.find((g) => g.id === goalId)?.name ?? 'Unknown') : '-';

  const showDayOfMonth = cadence === 'monthly' || cadence === 'quarterly' || cadence === 'yearly';
  const showDayOfWeek = cadence === 'weekly' || cadence === 'fortnightly';

  const handleSave = () => {
    setError(null);

    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (!amount || parseCentsFromInput(amount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }
    if (type === 'savings' && !savingsGoalId) {
      setError('Savings goal is required');
      return;
    }

    updateRule(rule.id, {
      type,
      description: description.trim(),
      amountCents: parseCentsFromInput(amount),
      cadence,
      ...(showDayOfMonth ? { dayOfMonth: parseInt(dayOfMonth, 10) } : {}),
      ...(showDayOfWeek ? { dayOfWeek: parseInt(dayOfWeek, 10) } : {}),
      categoryId: type === 'savings' ? null : categoryId || null,
      savingsGoalId: type === 'savings' ? savingsGoalId : null,
    });
    setEditing(false);
  };

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteRule(rule.id);
    navigate('/manage/rules');
  };

  const startEditing = () => {
    setType(rule.type);
    setDescription(rule.description);
    setAmount((rule.amountCents / 100).toFixed(2));
    setCadence(rule.cadence);
    setDayOfMonth(String(rule.dayOfMonth ?? 1));
    setDayOfWeek(String(rule.dayOfWeek ?? 0));
    setCategoryId(rule.categoryId ?? '');
    setSavingsGoalId(rule.savingsGoalId ?? '');
    setEditing(true);
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/manage/rules">
            <ArrowLeft className="h-4 w-4" />
            Back to Forecast Rules
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{rule.description}</h1>
            {rule.type === 'income' ? (
              <Badge variant="success">Income</Badge>
            ) : rule.type === 'savings' ? (
              <Badge variant="info">Savings</Badge>
            ) : (
              <Badge variant="destructive">Expense</Badge>
            )}
          </div>
          <p className="text-muted-foreground">{CADENCE_LABELS[rule.cadence]}</p>
        </div>
        <div
          className={`text-2xl font-bold ${
            rule.type === 'income'
              ? 'text-green-600'
              : rule.type === 'savings'
                ? 'text-blue-600'
                : 'text-red-600'
          }`}
        >
          {rule.type === 'income' ? '+' : '-'}
          {formatCents(rule.amountCents)}
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      <Separator className="my-6" />

      {/* Edit Section */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Rule Details</h2>
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
                onValueChange={(v) => setType(v as ForecastType)}
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
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="savings" id="savings" />
                  <Label htmlFor="savings" className="font-normal">
                    Savings
                  </Label>
                </div>
              </RadioGroup>
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
              <Label htmlFor="cadence">Frequency</Label>
              <Select value={cadence} onValueChange={(v) => setCadence(v as Cadence)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showDayOfMonth && (
              <div className="space-y-2">
                <Label htmlFor="dayOfMonth">Day of Month</Label>
                <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={String(day)}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showDayOfWeek && (
              <div className="space-y-2">
                <Label htmlFor="dayOfWeek">Day of Week</Label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_LABELS.map((day, index) => (
                      <SelectItem key={index} value={String(index)}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {type === 'savings' ? (
              <div className="space-y-2">
                <Label htmlFor="savingsGoal">Savings Goal</Label>
                <Select value={savingsGoalId} onValueChange={setSavingsGoalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select savings goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {savingsGoals.map((goal) => (
                      <SelectItem key={goal.id} value={goal.id}>
                        {goal.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
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
            )}

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
              {rule.type === 'income' ? 'Income' : rule.type === 'savings' ? 'Savings' : 'Expense'}
            </p>
            <p>
              <span className="text-muted-foreground">Description:</span> {rule.description}
            </p>
            <p>
              <span className="text-muted-foreground">Amount:</span> {formatCents(rule.amountCents)}
            </p>
            <p>
              <span className="text-muted-foreground">Frequency:</span>{' '}
              {CADENCE_LABELS[rule.cadence]}
            </p>
            {(rule.cadence === 'monthly' ||
              rule.cadence === 'quarterly' ||
              rule.cadence === 'yearly') && (
              <p>
                <span className="text-muted-foreground">Day of Month:</span> {rule.dayOfMonth ?? 1}
              </p>
            )}
            {(rule.cadence === 'weekly' || rule.cadence === 'fortnightly') && (
              <p>
                <span className="text-muted-foreground">Day of Week:</span>{' '}
                {DAY_LABELS[rule.dayOfWeek ?? 0]}
              </p>
            )}
            {rule.type === 'savings' ? (
              <p>
                <span className="text-muted-foreground">Savings Goal:</span>{' '}
                {getSavingsGoalName(rule.savingsGoalId)}
              </p>
            ) : (
              <p>
                <span className="text-muted-foreground">Category:</span>{' '}
                {getCategoryName(rule.categoryId)}
              </p>
            )}
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
              <h3 className="font-medium">Delete Rule</h3>
              <p className="text-sm text-muted-foreground">
                Permanently delete this forecast rule.
              </p>
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
