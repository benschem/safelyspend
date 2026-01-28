import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Pencil, Check, X, Trash2 } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useCategories } from '@/hooks/use-categories';
import { formatCents, parseCentsFromInput } from '@/lib/utils';
import type { Cadence, BudgetRule } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
}

interface BudgetRow {
  id: string;
  categoryId: string;
  categoryName: string;
  rule: BudgetRule | null;
}

const CADENCE_LABELS: Record<Cadence, string> = {
  weekly: 'weekly',
  fortnightly: 'fortnightly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  yearly: 'yearly',
};

const DAY_OF_WEEK_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatBudgetRule(rule: BudgetRule): string {
  const amount = formatCents(rule.amountCents);
  const cadence = CADENCE_LABELS[rule.cadence];

  if (rule.cadence === 'weekly' || rule.cadence === 'fortnightly') {
    const dayName = DAY_OF_WEEK_LABELS[rule.dayOfWeek ?? 0];
    return `${amount} ${cadence} on ${dayName}`;
  } else {
    const day = rule.dayOfMonth ?? 1;
    const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
    return `${amount} ${cadence} on the ${day}${suffix}`;
  }
}

export function BudgetPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { activeCategories } = useCategories();
  const { getRuleForCategory, setBudgetForCategory, deleteBudgetRule } =
    useBudgetRules(activeScenarioId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCadence, setEditCadence] = useState<Cadence>('monthly');
  const [editDay, setEditDay] = useState('1');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Build rows for all active categories
  const categoryRows: BudgetRow[] = useMemo(() => {
    return activeCategories
      .map((category) => ({
        id: category.id,
        categoryId: category.id,
        categoryName: category.name,
        rule: getRuleForCategory(category.id),
      }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }, [activeCategories, getRuleForCategory]);

  const startEditing = useCallback((categoryId: string) => {
    const rule = getRuleForCategory(categoryId);
    setEditAmount(rule ? (rule.amountCents / 100).toFixed(2) : '');
    setEditCadence(rule?.cadence ?? 'monthly');
    if (rule?.cadence === 'weekly' || rule?.cadence === 'fortnightly') {
      setEditDay(String(rule.dayOfWeek ?? 0));
    } else {
      setEditDay(String(rule?.dayOfMonth ?? 1));
    }
    setEditingId(categoryId);
  }, [getRuleForCategory]);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditAmount('');
    setEditCadence('monthly');
    setEditDay('1');
  }, []);

  const saveEditing = useCallback((categoryId: string) => {
    const amountCents = parseCentsFromInput(editAmount);
    if (amountCents > 0) {
      const isWeekly = editCadence === 'weekly' || editCadence === 'fortnightly';
      setBudgetForCategory(
        categoryId,
        amountCents,
        editCadence,
        isWeekly ? parseInt(editDay) : undefined,
        isWeekly ? undefined : parseInt(editDay),
      );
    } else {
      // If amount is 0 or empty, delete the rule
      const rule = getRuleForCategory(categoryId);
      if (rule) {
        deleteBudgetRule(rule.id);
      }
    }
    cancelEditing();
  }, [editAmount, editCadence, editDay, setBudgetForCategory, getRuleForCategory, deleteBudgetRule, cancelEditing]);

  const handleDelete = useCallback((categoryId: string) => {
    if (deletingId === categoryId) {
      const rule = getRuleForCategory(categoryId);
      if (rule) {
        deleteBudgetRule(rule.id);
      }
      setDeletingId(null);
    } else {
      setDeletingId(categoryId);
    }
  }, [deletingId, getRuleForCategory, deleteBudgetRule]);

  // Close editors on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) cancelEditing();
        if (deletingId) setDeletingId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingId, deletingId, cancelEditing]);

  const isWeeklyCadence = editCadence === 'weekly' || editCadence === 'fortnightly';

  const columns: ColumnDef<BudgetRow>[] = useMemo(
    () => [
      {
        accessorKey: 'categoryName',
        header: ({ column }) => <SortableHeader column={column}>Category</SortableHeader>,
        cell: ({ row }) => <span className="font-medium">{row.getValue('categoryName')}</span>,
      },
      {
        id: 'budget',
        header: 'Budget',
        cell: ({ row }) => {
          const budgetRow = row.original;
          const isEditing = editingId === budgetRow.id;

          if (isEditing) {
            return (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="h-8 w-24"
                  placeholder="0.00"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEditing(budgetRow.id);
                    if (e.key === 'Escape') cancelEditing();
                  }}
                />
                <Select
                  value={editCadence}
                  onValueChange={(v) => {
                    setEditCadence(v as Cadence);
                    // Reset day when switching cadence type
                    if (v === 'weekly' || v === 'fortnightly') {
                      setEditDay('1'); // Monday
                    } else {
                      setEditDay('1'); // 1st of month
                    }
                  }}
                >
                  <SelectTrigger className="h-8 w-32">
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
                <span className="text-sm text-muted-foreground">on</span>
                {isWeeklyCadence ? (
                  <Select value={editDay} onValueChange={setEditDay}>
                    <SelectTrigger className="h-8 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_OF_WEEK_LABELS.map((day, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={editDay} onValueChange={setEditDay}>
                    <SelectTrigger className="h-8 w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={String(day)}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          }

          if (budgetRow.rule) {
            return <span>{formatBudgetRule(budgetRow.rule)}</span>;
          }

          return <span className="text-muted-foreground">No budget set</span>;
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const budgetRow = row.original;
          const isEditing = editingId === budgetRow.id;
          const isDeleting = deletingId === budgetRow.id;

          if (isEditing) {
            return (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => saveEditing(budgetRow.id)}
                  title="Save"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelEditing}
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          }

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditing(budgetRow.id)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {budgetRow.rule && (
                <Button
                  variant={isDeleting ? 'destructive' : 'ghost'}
                  size="sm"
                  onClick={() => handleDelete(budgetRow.id)}
                  onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                  title={isDeleting ? 'Click again to confirm' : 'Delete'}
                >
                  {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [editingId, editAmount, editCadence, editDay, isWeeklyCadence, deletingId, startEditing, cancelEditing, saveEditing, handleDelete],
  );

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No scenario selected</h2>
        <p className="text-muted-foreground">Select a scenario to view budgets.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget Rules</h1>
          <p className="text-muted-foreground">
            Spending limits per category for {activeScenario.name}.
          </p>
        </div>
      </div>

      {activeCategories.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No categories found.</p>
          <Button asChild className="mt-4">
            <Link to="/categories">Add your first category</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          <DataTable
            columns={columns}
            data={categoryRows}
            searchKey="categoryName"
            searchPlaceholder="Search categories..."
            showPagination={false}
          />
        </div>
      )}
    </div>
  );
}
