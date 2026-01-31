import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Pencil, Trash2, Plus, Target, Archive, ArchiveRestore, Settings2, TrendingUp, PiggyBank } from 'lucide-react';
import { cn, formatCents } from '@/lib/utils';
import { CHART_COLORS } from '@/lib/chart-colors';
import { PageLoading } from '@/components/page-loading';
import { useScenarios } from '@/hooks/use-scenarios';
import { ScenarioSelector } from '@/components/scenario-selector';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useCategories } from '@/hooks/use-categories';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { CategoryBudgetDialog } from '@/components/dialogs/category-budget-dialog';
import { ForecastRuleDialog } from '@/components/dialogs/forecast-rule-dialog';
import type { Cadence, BudgetRule, Category, ForecastRule } from '@/lib/types';
import { SpendingBreakdownChart } from '@/components/charts/spending-breakdown-chart';
import { buildCategoryColorMap } from '@/lib/chart-colors';

type BudgetPeriod = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

interface OutletContext {
  activeScenarioId: string | null;
}

interface BudgetRow {
  id: string;
  category: Category;
  categoryName: string;
  budgetAmount: number;
  cadence: Cadence | null;
  rule: BudgetRule | null;
  transactionCount: number;
  forecastCount: number;
}

const CADENCE_FULL_LABELS: Record<Cadence, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

type BudgetTab = 'health' | 'categories' | 'recurring-expenses' | 'income' | 'savings-contributions' | 'scenarios';

const VALID_TABS: BudgetTab[] = ['health', 'categories', 'recurring-expenses', 'income', 'savings-contributions', 'scenarios'];

export function BudgetPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { categories, activeCategories, isLoading: categoriesLoading, addCategory, updateCategory, deleteCategory } = useCategories();
  const { getRuleForCategory, isLoading: budgetLoading, setBudgetForCategory, deleteBudgetRule } =
    useBudgetRules(activeScenarioId);
  const { allTransactions, isLoading: transactionsLoading } = useTransactions();
  const { savingsGoals, isLoading: savingsLoading } = useSavingsGoals();

  // Calculate date range for next 12 months (for expected income)
  const forecastDateRange = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const endDate = new Date(today.getFullYear() + 1, today.getMonth(), 0).toISOString().slice(0, 10);
    return { startDate, endDate };
  }, []);

  const { rules: forecastRules, savingsForecasts, incomeForecasts, isLoading: forecastsLoading, addRule, updateRule, deleteRule } = useForecasts(
    activeScenarioId,
    forecastDateRange.startDate,
    forecastDateRange.endDate,
  );

  const isLoading = categoriesLoading || budgetLoading || transactionsLoading || forecastsLoading || savingsLoading;

  // Tab state from URL
  const [activeTab, setActiveTab] = useState<BudgetTab>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && VALID_TABS.includes(tabParam as BudgetTab)) {
      return tabParam as BudgetTab;
    }
    return 'health';
  });

  // Sync tab state to URL
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (activeTab === 'health' && currentTab) {
      // Remove tab param when on default tab
      setSearchParams({}, { replace: true });
    } else if (activeTab !== 'health' && currentTab !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams]);

  // Period state for breakdown chart
  const [breakdownPeriod, setBreakdownPeriod] = useState<BudgetPeriod>('monthly');

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<BudgetRow | null>(null);
  const [focusLimit, setFocusLimit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hiddenSegments, setHiddenSegments] = useState<Set<string>>(new Set());

  // Forecast rule dialog state
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ForecastRule | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  // Filter state for expected expenses
  const [expenseFilterCategory, setExpenseFilterCategory] = useState<string>('all');

  // Compute transaction counts per category
  const transactionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of allTransactions) {
      if (t.categoryId) {
        counts[t.categoryId] = (counts[t.categoryId] ?? 0) + 1;
      }
    }
    return counts;
  }, [allTransactions]);

  // Compute forecast rule counts per category
  const forecastCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of forecastRules) {
      if (r.categoryId) {
        counts[r.categoryId] = (counts[r.categoryId] ?? 0) + 1;
      }
    }
    return counts;
  }, [forecastRules]);

  // Check if category has references (transactions or forecasts)
  const hasReferences = useCallback((id: string) => {
    return (transactionCounts[id] ?? 0) > 0 || (forecastCounts[id] ?? 0) > 0;
  }, [transactionCounts, forecastCounts]);

  // Get reference count text for warning
  const getReferenceText = useCallback((id: string) => {
    const txCount = transactionCounts[id] ?? 0;
    const fcCount = forecastCounts[id] ?? 0;
    const parts: string[] = [];
    if (txCount > 0) parts.push(`${txCount} transaction${txCount !== 1 ? 's' : ''}`);
    if (fcCount > 0) parts.push(`${fcCount} expected transaction${fcCount !== 1 ? 's' : ''}`);
    return parts.join(' and ');
  }, [transactionCounts, forecastCounts]);

  // Build rows from all categories (active first, then archived)
  const allRows: BudgetRow[] = useMemo(() => {
    return [...categories]
      .sort((a, b) => {
        // First sort by archived status
        if (a.isArchived !== b.isArchived) {
          return a.isArchived ? 1 : -1;
        }
        // Then by name
        return a.name.localeCompare(b.name);
      })
      .map((category) => {
        const rule = getRuleForCategory(category.id);
        return {
          id: category.id,
          category,
          categoryName: category.name,
          budgetAmount: rule?.amountCents ?? 0,
          cadence: rule?.cadence ?? null,
          rule,
          transactionCount: transactionCounts[category.id] ?? 0,
          forecastCount: forecastCounts[category.id] ?? 0,
        };
      });
  }, [categories, getRuleForCategory, transactionCounts, forecastCounts]);

  const categoryColorMap = useMemo(() => {
    const map = buildCategoryColorMap(activeCategories.map((c) => c.id));
    map['savings'] = CHART_COLORS.savings;
    map['unbudgeted'] = CHART_COLORS.available;
    return map;
  }, [activeCategories]);

  // Filter forecast rules by type
  const incomeRules = useMemo(() => forecastRules.filter(r => r.type === 'income'), [forecastRules]);
  const expenseRules = useMemo(() => {
    const expenses = forecastRules.filter(r => r.type === 'expense');
    if (expenseFilterCategory !== 'all') {
      return expenses.filter(r => r.categoryId === expenseFilterCategory);
    }
    return expenses;
  }, [forecastRules, expenseFilterCategory]);
  const savingsRules = useMemo(() => forecastRules.filter(r => r.type === 'savings'), [forecastRules]);

  // Helper to get category name
  const getCategoryName = useCallback(
    (id: string | null) => (id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '—'),
    [categories],
  );

  // Helper to get savings goal name
  const getSavingsGoalName = useCallback(
    (id: string | null) => (id ? (savingsGoals.find((g) => g.id === id)?.name ?? 'Unknown') : '—'),
    [savingsGoals],
  );

  // Normalize amounts to selected period
  const toPeriod = useCallback((amount: number, cadence: Cadence, period: BudgetPeriod): number => {
    // First convert to yearly, then to target period
    let yearly: number;
    switch (cadence) {
      case 'weekly': yearly = amount * 52; break;
      case 'fortnightly': yearly = amount * 26; break;
      case 'monthly': yearly = amount * 12; break;
      case 'quarterly': yearly = amount * 4; break;
      case 'yearly': yearly = amount; break;
    }
    switch (period) {
      case 'weekly': return Math.round(yearly / 52);
      case 'fortnightly': return Math.round(yearly / 26);
      case 'monthly': return Math.round(yearly / 12);
      case 'quarterly': return Math.round(yearly / 4);
      case 'yearly': return yearly;
    }
  }, []);

  // Calculate expected average income from next 12 months of forecasts
  const expectedIncome = useMemo(() => {
    if (incomeForecasts.length === 0) return null;

    // Sum all expected income over the next 12 months
    const totalYearlyIncome = incomeForecasts.reduce((sum, f) => sum + f.amountCents, 0);

    // Convert to each period
    return {
      weekly: Math.round(totalYearlyIncome / 52),
      fortnightly: Math.round(totalYearlyIncome / 26),
      monthly: Math.round(totalYearlyIncome / 12),
      quarterly: Math.round(totalYearlyIncome / 4),
      yearly: totalYearlyIncome,
    };
  }, [incomeForecasts]);

  const budgetBreakdownSegments = useMemo(() => {
    const tracked = allRows.filter((r) => r.rule && r.budgetAmount > 0 && !r.category.isArchived);
    const categorySegments = tracked
      .map((row) => ({
        id: row.id,
        name: row.categoryName,
        amount: toPeriod(row.budgetAmount, row.cadence!, breakdownPeriod),
      }))
      .sort((a, b) => b.amount - a.amount);

    // Always include savings if there are any
    // savingsForecasts spans 12 months, so divide by 12 to get monthly average
    const yearlySavings = savingsForecasts.reduce((sum, f) => sum + f.amountCents, 0);
    const monthlySavings = Math.round(yearlySavings / 12);
    if (monthlySavings > 0) {
      categorySegments.push({
        id: 'savings',
        name: 'Savings',
        amount: toPeriod(monthlySavings, 'monthly', breakdownPeriod),
      });
    }

    // Calculate unbudgeted income
    const periodIncome = expectedIncome?.[breakdownPeriod] ?? 0;
    const totalBudgeted = categorySegments.reduce((sum, s) => sum + s.amount, 0);
    const unbudgeted = periodIncome - totalBudgeted;

    if (unbudgeted > 0) {
      categorySegments.push({
        id: 'unbudgeted',
        name: 'Unbudgeted',
        amount: unbudgeted,
      });
    }

    return categorySegments;
  }, [allRows, savingsForecasts, breakdownPeriod, toPeriod, expectedIncome]);

  // Calculate total for chart (use income as base, or total budgeted if over-budget)
  const { chartTotal, incomeMarkerPercent } = useMemo(() => {
    const periodIncome = expectedIncome?.[breakdownPeriod] ?? 0;
    const totalBudgeted = budgetBreakdownSegments
      .filter((s) => s.id !== 'unbudgeted')
      .reduce((sum, s) => sum + s.amount, 0);

    if (periodIncome === 0) {
      // No income data - use total budgeted
      return { chartTotal: totalBudgeted, incomeMarkerPercent: undefined };
    }

    if (totalBudgeted > periodIncome) {
      // Over-budget: bar extends past income, show marker
      return {
        chartTotal: totalBudgeted,
        incomeMarkerPercent: Math.round((periodIncome / totalBudgeted) * 100),
      };
    }

    // Under-budget or exact: use income as total
    return { chartTotal: periodIncome, incomeMarkerPercent: undefined };
  }, [expectedIncome, breakdownPeriod, budgetBreakdownSegments]);

  const handleSegmentToggle = useCallback((id: string) => {
    setHiddenSegments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const openEditDialog = useCallback((row: BudgetRow, shouldFocusLimit = false) => {
    setEditingRow(row);
    setFocusLimit(shouldFocusLimit);
    setEditDialogOpen(true);
  }, []);

  const handleEditDialogClose = useCallback((open: boolean) => {
    setEditDialogOpen(open);
    if (!open) {
      setEditingRow(null);
      setFocusLimit(false);
    }
  }, []);

  const handleDelete = useCallback(
    (categoryId: string) => {
      if (deletingId === categoryId) {
        deleteCategory(categoryId);
        setDeletingId(null);
      } else {
        setDeletingId(categoryId);
      }
    },
    [deletingId, deleteCategory],
  );

  // Forecast rule handlers
  const openAddRuleDialog = useCallback(() => {
    setEditingRule(null);
    setRuleDialogOpen(true);
  }, []);

  const openEditRuleDialog = useCallback((rule: ForecastRule) => {
    setEditingRule(rule);
    setRuleDialogOpen(true);
  }, []);

  const handleRuleDialogClose = useCallback((open: boolean) => {
    setRuleDialogOpen(open);
    if (!open) setEditingRule(null);
  }, []);

  const handleDeleteRule = useCallback((id: string) => {
    if (deletingRuleId === id) {
      deleteRule(id);
      setDeletingRuleId(null);
    } else {
      setDeletingRuleId(id);
    }
  }, [deletingRuleId, deleteRule]);

  // Close delete confirmation on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deletingId) setDeletingId(null);
        if (deletingRuleId) setDeletingRuleId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deletingId, deletingRuleId]);

  const columns: ColumnDef<BudgetRow>[] = useMemo(
    () => [
      {
        accessorKey: 'categoryName',
        header: ({ column }) => <SortableHeader column={column}>Category</SortableHeader>,
        cell: ({ row }) => {
          const budgetRow = row.original;
          const isArchived = budgetRow.category.isArchived;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={`/categories/${budgetRow.id}`}
                    className={`font-medium hover:underline ${isArchived ? 'text-muted-foreground' : ''}`}
                  >
                    {budgetRow.categoryName}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>View category details</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: 'isArchived',
        header: ({ column }) => <SortableHeader column={column}>Archived?</SortableHeader>,
        accessorFn: (row) => row.category.isArchived,
        cell: ({ row }) =>
          row.original.category.isArchived ? (
            <Badge variant="secondary">Archived</Badge>
          ) : null,
      },
      {
        accessorKey: 'budgetAmount',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Budget
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const budgetRow = row.original;
          const isArchived = budgetRow.category.isArchived;

          if (!budgetRow.rule) {
            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => openEditDialog(budgetRow, true)}
                      className={`cursor-pointer text-right text-sm hover:underline hover:text-foreground ${isArchived ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}
                    >
                      Set budget
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Set a spending expectation for this category</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => openEditDialog(budgetRow, true)}
                    className={`cursor-pointer text-right hover:underline ${isArchived ? 'text-muted-foreground' : ''}`}
                  >
                    <span className="font-mono">{formatCents(budgetRow.budgetAmount)}</span>
                    <span className="ml-1 text-muted-foreground">{CADENCE_FULL_LABELS[budgetRow.cadence!]}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Edit spending expectation</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: 'transactionCount',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-center">
            Past Transactions
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const budgetRow = row.original;
          const count = budgetRow.transactionCount;
          const isArchived = budgetRow.category.isArchived;
          if (count === 0) {
            return <div className={`text-center ${isArchived ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>—</div>;
          }
          return (
            <div className="text-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={`/money?category=${budgetRow.id}&from=budget`}
                      className={`hover:underline ${isArchived ? 'text-muted-foreground' : ''}`}
                    >
                      {count}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>View past transactions in this category</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
      },
      {
        accessorKey: 'forecastCount',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-center">
            Expected Transactions
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const budgetRow = row.original;
          const count = budgetRow.forecastCount;
          const isArchived = budgetRow.category.isArchived;
          if (count === 0) {
            return <div className={`text-center ${isArchived ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>—</div>;
          }
          return (
            <div className="text-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={`/money?tab=expected&category=${budgetRow.id}&from=budget`}
                      className={`hover:underline ${isArchived ? 'text-muted-foreground' : ''}`}
                    >
                      {count}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>View expected transactions in this category</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const budgetRow = row.original;
          const isDeleting = deletingId === budgetRow.id;
          const isArchived = budgetRow.category.isArchived;

          return (
            <TooltipProvider>
              <div className="flex justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(budgetRow)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateCategory(budgetRow.id, { isArchived: !isArchived })}
                      aria-label={isArchived ? 'Restore' : 'Archive'}
                    >
                      {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isArchived ? 'Restore' : 'Archive'}</TooltipContent>
                </Tooltip>
                {hasReferences(budgetRow.id) ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          className="pointer-events-none"
                          aria-label="Delete (disabled)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Archive instead — used by {getReferenceText(budgetRow.id)}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isDeleting ? 'destructive' : 'ghost'}
                        size="sm"
                        onClick={() => handleDelete(budgetRow.id)}
                        onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                        aria-label={isDeleting ? 'Confirm delete' : 'Delete'}
                      >
                        {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isDeleting ? 'Click to confirm' : 'Delete'}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
          );
        },
      },
    ],
    [deletingId, openEditDialog, handleDelete, updateCategory, hasReferences, getReferenceText],
  );

  // Income rules columns
  const incomeColumns: ColumnDef<ForecastRule>[] = useMemo(
    () => [
      {
        accessorKey: 'description',
        header: ({ column }) => <SortableHeader column={column}>Description</SortableHeader>,
        cell: ({ row }) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => openEditRuleDialog(row.original)}
                  className="cursor-pointer text-left font-medium hover:underline"
                >
                  {row.getValue('description')}
                </button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
      {
        accessorKey: 'cadence',
        header: 'Cadence',
        cell: ({ row }) => (
          <Badge variant="outline">{CADENCE_FULL_LABELS[row.getValue('cadence') as Cadence]}</Badge>
        ),
      },
      {
        accessorKey: 'amountCents',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Amount
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-default text-right font-mono text-green-600">
                  +{formatCents(row.getValue('amountCents'))}
                </div>
              </TooltipTrigger>
              <TooltipContent>Recurring income</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const rule = row.original;
          const isDeleting = deletingRuleId === rule.id;
          return (
            <TooltipProvider>
              <div className="flex justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => openEditRuleDialog(rule)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isDeleting ? 'destructive' : 'ghost'}
                      size="sm"
                      onClick={() => handleDeleteRule(rule.id)}
                      onBlur={() => setTimeout(() => setDeletingRuleId(null), 200)}
                      aria-label={isDeleting ? 'Confirm delete' : 'Delete'}
                    >
                      {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isDeleting ? 'Click to confirm' : 'Delete'}</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          );
        },
      },
    ],
    [deletingRuleId, openEditRuleDialog, handleDeleteRule],
  );

  // Expense rules columns
  const expenseColumns: ColumnDef<ForecastRule>[] = useMemo(
    () => [
      {
        accessorKey: 'description',
        header: ({ column }) => <SortableHeader column={column}>Description</SortableHeader>,
        cell: ({ row }) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => openEditRuleDialog(row.original)}
                  className="cursor-pointer text-left font-medium hover:underline"
                >
                  {row.getValue('description')}
                </button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
      {
        accessorKey: 'categoryId',
        header: 'Category',
        cell: ({ row }) => {
          const categoryId = row.getValue('categoryId') as string | null;
          const categoryName = getCategoryName(categoryId);
          if (!categoryId) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <Link to={`/categories/${categoryId}`} className="hover:underline">
              {categoryName}
            </Link>
          );
        },
      },
      {
        accessorKey: 'cadence',
        header: 'Cadence',
        cell: ({ row }) => (
          <Badge variant="outline">{CADENCE_FULL_LABELS[row.getValue('cadence') as Cadence]}</Badge>
        ),
      },
      {
        accessorKey: 'amountCents',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Amount
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-default text-right font-mono text-red-600">
                  -{formatCents(row.getValue('amountCents'))}
                </div>
              </TooltipTrigger>
              <TooltipContent>Recurring expense</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const rule = row.original;
          const isDeleting = deletingRuleId === rule.id;
          return (
            <TooltipProvider>
              <div className="flex justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => openEditRuleDialog(rule)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isDeleting ? 'destructive' : 'ghost'}
                      size="sm"
                      onClick={() => handleDeleteRule(rule.id)}
                      onBlur={() => setTimeout(() => setDeletingRuleId(null), 200)}
                      aria-label={isDeleting ? 'Confirm delete' : 'Delete'}
                    >
                      {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isDeleting ? 'Click to confirm' : 'Delete'}</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          );
        },
      },
    ],
    [deletingRuleId, openEditRuleDialog, handleDeleteRule, getCategoryName],
  );

  // Savings rules columns
  const savingsColumns: ColumnDef<ForecastRule>[] = useMemo(
    () => [
      {
        accessorKey: 'description',
        header: ({ column }) => <SortableHeader column={column}>Description</SortableHeader>,
        cell: ({ row }) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => openEditRuleDialog(row.original)}
                  className="cursor-pointer text-left font-medium hover:underline"
                >
                  {row.getValue('description')}
                </button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
      {
        accessorKey: 'savingsGoalId',
        header: 'Savings Goal',
        cell: ({ row }) => getSavingsGoalName(row.getValue('savingsGoalId')),
      },
      {
        accessorKey: 'cadence',
        header: 'Cadence',
        cell: ({ row }) => (
          <Badge variant="outline">{CADENCE_FULL_LABELS[row.getValue('cadence') as Cadence]}</Badge>
        ),
      },
      {
        accessorKey: 'amountCents',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Amount
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-default text-right font-mono text-blue-600">
                  -{formatCents(row.getValue('amountCents'))}
                </div>
              </TooltipTrigger>
              <TooltipContent>Recurring savings contribution</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const rule = row.original;
          const isDeleting = deletingRuleId === rule.id;
          return (
            <TooltipProvider>
              <div className="flex justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => openEditRuleDialog(rule)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isDeleting ? 'destructive' : 'ghost'}
                      size="sm"
                      onClick={() => handleDeleteRule(rule.id)}
                      onBlur={() => setTimeout(() => setDeletingRuleId(null), 200)}
                      aria-label={isDeleting ? 'Confirm delete' : 'Delete'}
                    >
                      {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isDeleting ? 'Click to confirm' : 'Delete'}</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          );
        },
      },
    ],
    [deletingRuleId, openEditRuleDialog, handleDeleteRule, getSavingsGoalName],
  );

  // Show loading spinner while data is being fetched
  if (isLoading) {
    return (
      <div className="page-shell">
        <PageLoading />
      </div>
    );
  }

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <Target className="h-5 w-5 text-slate-500" />
            </div>
            Budget
          </h1>
          <p className="page-description">Manage spending categories and set budget limits</p>
        </div>
        <div className="empty-state">
          <p className="empty-state-text">Select a scenario to configure spending expectations.</p>
          <Button asChild className="empty-state-action">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <Target className="h-5 w-5 text-slate-500" />
            </div>
            Budget
          </h1>
          <p className="page-description">Manage spending categories and set budget limits</p>
        </div>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <ScenarioSelector />
            {activeTab === 'categories' && (
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Category
              </Button>
            )}
            {activeTab === 'income' && (
              <Button onClick={openAddRuleDialog}>
                <Plus className="h-4 w-4" />
                Add Income
              </Button>
            )}
            {activeTab === 'recurring-expenses' && (
              <Button onClick={openAddRuleDialog}>
                <Plus className="h-4 w-4" />
                Add Expense
              </Button>
            )}
            {activeTab === 'savings-contributions' && (
              <Button onClick={openAddRuleDialog}>
                <Plus className="h-4 w-4" />
                Add Contribution
              </Button>
            )}
          </div>
          {/* Always render to maintain consistent height, hide on non-categories tabs */}
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn('text-muted-foreground', activeTab !== 'categories' && 'invisible')}
          >
            <Link to="/categories/import-rules">
              <Settings2 className="h-4 w-4" />
              Manage Import Rules
            </Link>
          </Button>
        </div>
      </div>

      {/* Main tabs */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
        {[
          { value: 'health' as BudgetTab, label: 'Health' },
          { value: 'categories' as BudgetTab, label: 'Categories' },
          { value: 'recurring-expenses' as BudgetTab, label: 'Recurring Expenses' },
          { value: 'income' as BudgetTab, label: 'Income' },
          { value: 'savings-contributions' as BudgetTab, label: 'Savings Contributions' },
          { value: 'scenarios' as BudgetTab, label: 'Scenarios' },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'inline-flex h-8 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium transition-all',
              activeTab === tab.value
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Health tab - Breakdown Chart */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {/* Period dropdown */}
          <div className="flex justify-end">
            <Select value={breakdownPeriod} onValueChange={(v) => setBreakdownPeriod(v as BudgetPeriod)}>
              <SelectTrigger className="w-36">
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

          {/* Stats cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Income card */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Expected Income</span>
              </div>
              <p className="mt-2 text-2xl font-bold">
                {expectedIncome ? formatCents(expectedIncome[breakdownPeriod]) : '—'}
              </p>
            </div>

            {/* Savings card */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Planned Savings</span>
              </div>
              <p className="mt-2 text-2xl font-bold">
                {formatCents(budgetBreakdownSegments.find((s) => s.id === 'savings')?.amount ?? 0)}
              </p>
            </div>

            {/* Budget status card */}
            {(() => {
              const unbudgetedAmount = budgetBreakdownSegments.find((s) => s.id === 'unbudgeted')?.amount ?? 0;
              const isOverBudget = incomeMarkerPercent !== undefined;
              const overBudgetAmount = isOverBudget && expectedIncome ? chartTotal - expectedIncome[breakdownPeriod] : 0;
              const periodIncome = expectedIncome?.[breakdownPeriod] ?? 0;
              const unbudgetedPercent = periodIncome > 0 ? (unbudgetedAmount / periodIncome) * 100 : 0;
              const isFullyBudgeted = !isOverBudget && unbudgetedPercent < 2;

              if (!expectedIncome || budgetBreakdownSegments.length === 0) {
                return (
                  <div className="rounded-xl border bg-card p-5">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Budgeted</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-muted-foreground">—</p>
                  </div>
                );
              }

              if (isFullyBudgeted) {
                return (
                  <div className="rounded-xl border bg-card p-5">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">Budgeted</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">100%</p>
                    <p className="text-sm text-muted-foreground">of {formatCents(periodIncome)} income</p>
                  </div>
                );
              }

              if (isOverBudget) {
                return (
                  <div className="rounded-xl border border-amber-500/50 bg-amber-500/5 p-5">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-muted-foreground">Overcommitted</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {formatCents(overBudgetAmount)}
                    </p>
                    <p className="text-sm text-muted-foreground">over {formatCents(periodIncome)} income</p>
                  </div>
                );
              }

              return (
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Unbudgeted</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCents(unbudgetedAmount)}
                  </p>
                  <p className="text-sm text-muted-foreground">of {formatCents(periodIncome)} income</p>
                </div>
              );
            })()}
          </div>

          {/* Income Breakdown chart */}
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Income Breakdown</h3>
              <p className="text-sm text-muted-foreground">How your expected income is allocated across categories.</p>
            </div>

            {!expectedIncome ? (
              budgetBreakdownSegments.length > 0 ? (
                <>
                  <SpendingBreakdownChart
                    segments={budgetBreakdownSegments}
                    total={chartTotal}
                    colorMap={categoryColorMap}
                    disableToggle
                    toggleableIds={['unbudgeted']}
                    hiddenSegmentIds={hiddenSegments}
                    onSegmentToggle={handleSegmentToggle}
                  />
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    Add expected income to see budget relative to income.
                  </p>
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No budgets set yet. Set spending expectations in the Manage tab to see your allocation.
                </p>
              )
            ) : budgetBreakdownSegments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No budgets set yet. Set spending expectations in the Manage tab to see your allocation.
              </p>
            ) : (
              <SpendingBreakdownChart
                segments={budgetBreakdownSegments}
                total={chartTotal}
                colorMap={categoryColorMap}
                disableToggle
                toggleableIds={['unbudgeted']}
                hiddenSegmentIds={hiddenSegments}
                onSegmentToggle={handleSegmentToggle}
                {...(incomeMarkerPercent !== undefined && { incomeMarker: incomeMarkerPercent })}
              />
            )}
          </div>
        </div>
      )}

      {/* Categories tab - table with categories and limits */}
      {activeTab === 'categories' && (
        <>
          <Alert variant="info" className="mb-6">
            Budgets for each category. They vary by scenario.
          </Alert>

          {categories.length === 0 ? (
            <div className="space-y-4">
              <Alert variant="info">
                Create categories like groceries, transport, or entertainment to see where your money goes.
              </Alert>
              <div className="empty-state">
                <p className="empty-state-text">No categories yet.</p>
                <Button className="empty-state-action" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add your first category
                </Button>
              </div>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={allRows}
              searchKey="categoryName"
              searchPlaceholder="Search categories..."
              showPagination={false}
            />
          )}
        </>
      )}

      {/* Recurring Expenses tab */}
      {activeTab === 'recurring-expenses' && (
        <>
          <Alert variant="info" className="mb-6">
            Expected recurring expenses. They vary by scenario.
          </Alert>

          {expenseRules.length === 0 && expenseFilterCategory === 'all' ? (
            <div className="empty-state">
              <p className="empty-state-text">No expected expenses yet.</p>
              <Button className="empty-state-action" onClick={openAddRuleDialog}>
                <Plus className="h-4 w-4" />
                Add expected expense
              </Button>
            </div>
          ) : (
            <DataTable
              columns={expenseColumns}
              data={expenseRules}
              searchKey="description"
              searchPlaceholder="Search expenses..."
              showPagination={false}
              emptyMessage="No expected expenses found matching your filters."
              filterSlot={
                <Select value={expenseFilterCategory} onValueChange={setExpenseFilterCategory}>
                  <SelectTrigger className={`w-44 ${expenseFilterCategory === 'all' ? 'text-muted-foreground' : ''}`}>
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
              }
            />
          )}
        </>
      )}

      {/* Income tab */}
      {activeTab === 'income' && (
        <>
          <Alert variant="info" className="mb-6">
            Expected regular income. It varies by scenario.
          </Alert>

          {incomeRules.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">No expected income yet.</p>
              <Button className="empty-state-action" onClick={openAddRuleDialog}>
                <Plus className="h-4 w-4" />
                Add expected income
              </Button>
            </div>
          ) : (
            <DataTable
              columns={incomeColumns}
              data={incomeRules}
              searchKey="description"
              searchPlaceholder="Search income..."
              showPagination={false}
            />
          )}
        </>
      )}

      {/* Savings Contributions tab */}
      {activeTab === 'savings-contributions' && (
        <>
          <Alert variant="info" className="mb-6">
            Expected regular contributions to savings goals. They vary by scenario.
          </Alert>

          {savingsRules.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">No expected savings contributions yet.</p>
              <Button className="empty-state-action" onClick={openAddRuleDialog}>
                <Plus className="h-4 w-4" />
                Add expected savings contribution
              </Button>
            </div>
          ) : (
            <DataTable
              columns={savingsColumns}
              data={savingsRules}
              searchKey="description"
              searchPlaceholder="Search savings..."
              showPagination={false}
            />
          )}
        </>
      )}

      {/* Scenarios tab - placeholder */}
      {activeTab === 'scenarios' && (
        <div className="empty-state">
          <p className="empty-state-text">Manage scenarios coming soon.</p>
          <Button asChild className="empty-state-action">
            <Link to="/scenarios">Go to Scenarios page</Link>
          </Button>
        </div>
      )}

      {/* Add Category Dialog */}
      <CategoryBudgetDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        scenarioId={activeScenarioId}
        addCategory={addCategory}
        setBudgetForCategory={setBudgetForCategory}
      />

      {/* Edit Category Dialog */}
      {editingRow && (
        <CategoryBudgetDialog
          open={editDialogOpen}
          onOpenChange={handleEditDialogClose}
          scenarioId={activeScenarioId}
          category={editingRow.category}
          existingRule={editingRow.rule}
          focusLimit={focusLimit}
          addCategory={addCategory}
          updateCategory={updateCategory}
          setBudgetForCategory={setBudgetForCategory}
          deleteBudgetRule={deleteBudgetRule}
        />
      )}

      {/* Forecast Rule Dialog */}
      <ForecastRuleDialog
        open={ruleDialogOpen}
        onOpenChange={handleRuleDialogClose}
        scenarioId={activeScenarioId}
        rule={editingRule}
        addRule={addRule}
        updateRule={updateRule}
        restrictType={
          activeTab === 'recurring-expenses' ? 'expense' :
          activeTab === 'income' ? 'income' :
          activeTab === 'savings-contributions' ? 'savings' :
          null
        }
      />
    </div>
  );
}
