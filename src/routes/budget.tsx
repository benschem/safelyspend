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
import { Pencil, Check, X, Trash2, Plus, FolderTree } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { ScenarioSelector } from '@/components/scenario-selector';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useCategories } from '@/hooks/use-categories';
import { CategoryBudgetDialog } from '@/components/dialogs/category-budget-dialog';
import { formatCents, parseCentsFromInput } from '@/lib/utils';
import type { Cadence, BudgetRule } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
}

interface BudgetRow {
  id: string;
  categoryId: string;
  categoryName: string;
  amountCents: number;
  cadence: Cadence | null;
  day: number | null;
  monthOfQuarter: number | null;
  rule: BudgetRule | null;
}

const CADENCE_LABELS: Record<Cadence, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const DAY_OF_WEEK_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_OF_QUARTER_LABELS = ['1st month', '2nd month', '3rd month'];

function formatDay(
  cadence: Cadence | null,
  day: number | null,
  monthOfQuarter: number | null,
): string {
  if (cadence === null || day === null) return '-';
  if (cadence === 'weekly' || cadence === 'fortnightly') {
    return DAY_OF_WEEK_LABELS[day] ?? '-';
  }
  if (cadence === 'quarterly') {
    const monthLabel = MONTH_OF_QUARTER_LABELS[monthOfQuarter ?? 0] ?? '1st month';
    return `${monthLabel}, day ${day}`;
  }
  return String(day);
}

type FilterMode = 'all' | 'no-budget';

export function BudgetPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { activeCategories } = useCategories();
  const { getRuleForCategory, setBudgetForCategory, deleteBudgetRule } =
    useBudgetRules(activeScenarioId);

  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCadence, setEditCadence] = useState<Cadence>('monthly');
  const [editDay, setEditDay] = useState('1');
  const [editMonthOfQuarter, setEditMonthOfQuarter] = useState('0');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Build rows for all active categories
  const allRows: BudgetRow[] = useMemo(() => {
    return activeCategories.map((category) => {
      const rule = getRuleForCategory(category.id);
      const isWeekly = rule?.cadence === 'weekly' || rule?.cadence === 'fortnightly';
      return {
        id: category.id,
        categoryId: category.id,
        categoryName: category.name,
        amountCents: rule?.amountCents ?? 0,
        cadence: rule?.cadence ?? null,
        day: rule ? (isWeekly ? (rule.dayOfWeek ?? 0) : (rule.dayOfMonth ?? 1)) : null,
        monthOfQuarter: rule?.monthOfQuarter ?? null,
        rule,
      };
    });
  }, [activeCategories, getRuleForCategory]);

  // Apply filter
  const categoryRows = useMemo(() => {
    if (filterMode === 'no-budget') {
      return allRows.filter((row) => !row.rule);
    }
    return allRows;
  }, [allRows, filterMode]);

  const noBudgetCount = useMemo(() => allRows.filter((row) => !row.rule).length, [allRows]);

  const startEditing = useCallback((categoryId: string) => {
    const rule = getRuleForCategory(categoryId);
    setEditAmount(rule ? (rule.amountCents / 100).toFixed(2) : '');
    setEditCadence(rule?.cadence ?? 'monthly');
    if (rule?.cadence === 'weekly' || rule?.cadence === 'fortnightly') {
      setEditDay(String(rule.dayOfWeek ?? 0));
    } else {
      setEditDay(String(rule?.dayOfMonth ?? 1));
    }
    setEditMonthOfQuarter(String(rule?.monthOfQuarter ?? 0));
    setEditingId(categoryId);
  }, [getRuleForCategory]);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditAmount('');
    setEditCadence('monthly');
    setEditDay('1');
    setEditMonthOfQuarter('0');
  }, []);

  const saveEditing = useCallback((categoryId: string) => {
    const amountCents = parseCentsFromInput(editAmount);
    if (amountCents > 0) {
      const isWeekly = editCadence === 'weekly' || editCadence === 'fortnightly';
      const isQuarterly = editCadence === 'quarterly';
      setBudgetForCategory(
        categoryId,
        amountCents,
        editCadence,
        isWeekly ? parseInt(editDay) : undefined,
        isWeekly ? undefined : parseInt(editDay),
        isQuarterly ? parseInt(editMonthOfQuarter) : undefined,
      );
    } else {
      // If amount is 0 or empty, delete the rule
      const rule = getRuleForCategory(categoryId);
      if (rule) {
        deleteBudgetRule(rule.id);
      }
    }
    cancelEditing();
  }, [editAmount, editCadence, editDay, editMonthOfQuarter, setBudgetForCategory, getRuleForCategory, deleteBudgetRule, cancelEditing]);

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
  const isQuarterlyCadence = editCadence === 'quarterly';

  const columns: ColumnDef<BudgetRow>[] = useMemo(
    () => [
      {
        accessorKey: 'categoryName',
        header: ({ column }) => <SortableHeader column={column}>Category</SortableHeader>,
        cell: ({ row }) => <span className="font-medium">{row.getValue('categoryName')}</span>,
      },
      {
        accessorKey: 'amountCents',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Amount
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const budgetRow = row.original;
          const isEditing = editingId === budgetRow.id;

          if (isEditing) {
            return (
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="h-8 w-28"
                placeholder="0.00"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEditing(budgetRow.id);
                  if (e.key === 'Escape') cancelEditing();
                }}
                autoFocus
              />
            );
          }

          const amount = row.getValue('amountCents') as number;
          return (
            <div className="text-right font-mono">
              {amount > 0 ? formatCents(amount) : <span className="text-muted-foreground">-</span>}
            </div>
          );
        },
      },
      {
        accessorKey: 'cadence',
        header: ({ column }) => <SortableHeader column={column}>Cadence</SortableHeader>,
        cell: ({ row }) => {
          const budgetRow = row.original;
          const isEditing = editingId === budgetRow.id;

          if (isEditing) {
            return (
              <Select
                value={editCadence}
                onValueChange={(v) => {
                  setEditCadence(v as Cadence);
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
            );
          }

          const cadence = row.getValue('cadence') as Cadence | null;
          return cadence ? CADENCE_LABELS[cadence] : <span className="text-muted-foreground">-</span>;
        },
      },
      {
        accessorKey: 'day',
        header: ({ column }) => <SortableHeader column={column}>Day</SortableHeader>,
        cell: ({ row }) => {
          const budgetRow = row.original;
          const isEditing = editingId === budgetRow.id;

          if (isEditing) {
            if (isWeeklyCadence) {
              return (
                <Select value={editDay} onValueChange={setEditDay}>
                  <SelectTrigger className="h-8 w-20">
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
              );
            }

            if (isQuarterlyCadence) {
              return (
                <div className="flex gap-1">
                  <Select value={editMonthOfQuarter} onValueChange={setEditMonthOfQuarter}>
                    <SelectTrigger className="h-8 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_OF_QUARTER_LABELS.map((label, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={editDay} onValueChange={setEditDay}>
                    <SelectTrigger className="h-8 w-16">
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
                </div>
              );
            }

            // Monthly or yearly
            return (
              <Select value={editDay} onValueChange={setEditDay}>
                <SelectTrigger className="h-8 w-16">
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
            );
          }

          return formatDay(budgetRow.cadence, budgetRow.day, budgetRow.monthOfQuarter);
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
    [editingId, editAmount, editCadence, editDay, editMonthOfQuarter, isWeeklyCadence, isQuarterlyCadence, deletingId, startEditing, cancelEditing, saveEditing, handleDelete],
  );

  if (!activeScenarioId || !activeScenario) {
    return (
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold">
              <FolderTree className="h-7 w-7" />
              Budgets
            </h1>
            <p className="mt-1 text-muted-foreground">Spending limits per category.</p>
          </div>
        </div>
        <div className="mt-6">
          <ScenarioSelector />
        </div>
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Select a scenario to view budgets.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <FolderTree className="h-7 w-7" />
            Budgets
          </h1>
          <p className="mt-1 text-muted-foreground">
            Spending limits per category for {activeScenario.name}.
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      <div className="mt-6">
        <ScenarioSelector />
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
            filterSlot={
              <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="no-budget">
                    No budget set ({noBudgetCount})
                  </SelectItem>
                </SelectContent>
              </Select>
            }
          />
        </div>
      )}

      <CategoryBudgetDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        scenarioId={activeScenarioId}
      />
    </div>
  );
}
