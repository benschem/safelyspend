import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
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
import { CategoryBudgetDialog } from '@/components/dialogs/category-budget-dialog';
import type { Cadence, BudgetRule, Category } from '@/lib/types';
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

type BudgetTab = 'status' | 'manage-budget' | 'expected-expenses' | 'expected-income' | 'expected-savings' | 'manage-scenarios';

const VALID_TABS: BudgetTab[] = ['status', 'manage-budget', 'expected-expenses', 'expected-income', 'expected-savings', 'manage-scenarios'];

export function BudgetPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { categories, activeCategories, isLoading: categoriesLoading, addCategory, updateCategory, deleteCategory } = useCategories();
  const { getRuleForCategory, isLoading: budgetLoading, setBudgetForCategory, deleteBudgetRule } =
    useBudgetRules(activeScenarioId);
  const { allTransactions, isLoading: transactionsLoading } = useTransactions();

  // Calculate date range for next 12 months (for expected income)
  const forecastDateRange = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const endDate = new Date(today.getFullYear() + 1, today.getMonth(), 0).toISOString().slice(0, 10);
    return { startDate, endDate };
  }, []);

  const { rules: forecastRules, savingsForecasts, incomeForecasts, isLoading: forecastsLoading } = useForecasts(
    activeScenarioId,
    forecastDateRange.startDate,
    forecastDateRange.endDate,
  );

  const isLoading = categoriesLoading || budgetLoading || transactionsLoading || forecastsLoading;

  // Tab state from URL
  const [activeTab, setActiveTab] = useState<BudgetTab>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && VALID_TABS.includes(tabParam as BudgetTab)) {
      return tabParam as BudgetTab;
    }
    return 'status';
  });

  // Sync tab state to URL
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (activeTab === 'status' && currentTab) {
      // Remove tab param when on default tab
      setSearchParams({}, { replace: true });
    } else if (activeTab !== 'status' && currentTab !== activeTab) {
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

  // Close delete confirmation on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && deletingId) {
        setDeletingId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deletingId]);

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
                  <TooltipContent>Set a spending limit for this category</TooltipContent>
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
                <TooltipContent>Edit spending limit</TooltipContent>
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
          <p className="empty-state-text">Select a scenario to configure spending limits.</p>
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
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <ScenarioSelector />
            {activeTab === 'manage-budget' && (
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Category
              </Button>
            )}
          </div>
          {activeTab === 'manage-budget' && (
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
              <Link to="/categories/import-rules">
                <Settings2 className="h-4 w-4" />
                Manage Import Rules
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Main tabs */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
        {[
          { value: 'status' as BudgetTab, label: 'Status' },
          { value: 'manage-budget' as BudgetTab, label: 'Manage Budget' },
          { value: 'expected-expenses' as BudgetTab, label: 'Expected Expenses' },
          { value: 'expected-income' as BudgetTab, label: 'Expected Income' },
          { value: 'expected-savings' as BudgetTab, label: 'Expected Savings Contributions' },
          { value: 'manage-scenarios' as BudgetTab, label: 'Manage Scenarios' },
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

      {/* Status tab - Breakdown Chart */}
      {activeTab === 'status' && (
        <div className="rounded-xl border bg-card p-5">
        {/* Period tabs - top */}
        <div className="flex justify-center">
          <div className="flex rounded-lg bg-muted p-1">
            {(['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setBreakdownPeriod(period)}
                className={cn(
                  'cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  breakdownPeriod === period
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row: Expected Income, Saved, Unbudgeted */}
        <div className="mt-4 flex items-start justify-center gap-8">
          {/* Expected Income */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Expected Income</span>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {expectedIncome ? formatCents(expectedIncome[breakdownPeriod]) : '—'}
            </p>
          </div>

          {/* Planned Savings Contributions */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <PiggyBank className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Planned Savings Contributions</span>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {(() => {
                const savingsAmount = budgetBreakdownSegments.find((s) => s.id === 'savings')?.amount ?? 0;
                return formatCents(savingsAmount);
              })()}
            </p>
          </div>

          {/* Unbudgeted */}
          {expectedIncome && budgetBreakdownSegments.length > 0 && (
            (() => {
              const unbudgetedAmount = budgetBreakdownSegments.find((s) => s.id === 'unbudgeted')?.amount ?? 0;
              const isOverBudget = incomeMarkerPercent !== undefined;
              const overBudgetAmount = isOverBudget ? chartTotal - expectedIncome[breakdownPeriod] : 0;
              const periodIncome = expectedIncome[breakdownPeriod];

              // Calculate percentage of income that's unbudgeted
              const unbudgetedPercent = periodIncome > 0 ? (unbudgetedAmount / periodIncome) * 100 : 0;

              // Normalize: if unbudgeted is less than 2% of income, consider it fully budgeted
              const isFullyBudgeted = !isOverBudget && unbudgetedPercent < 2;

              const periodLabels: Record<BudgetPeriod, string> = {
                weekly: 'per week',
                fortnightly: 'per fortnight',
                monthly: 'per month',
                quarterly: 'per quarter',
                yearly: 'per year',
              };

              if (isFullyBudgeted) {
                return (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Budgeted</p>
                    <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">100%</p>
                    <p className="text-xs text-muted-foreground">of income</p>
                  </div>
                );
              }

              return (
                <div className={cn(
                  'text-center',
                  isOverBudget && 'rounded-lg border border-amber-500/50 bg-amber-500/5 px-4 py-2',
                )}>
                  <p className="text-sm text-muted-foreground">
                    {isOverBudget ? 'Overcommitted' : 'Unbudgeted'}
                  </p>
                  <p className={cn(
                    'mt-1 text-2xl font-bold',
                    isOverBudget ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400',
                  )}>
                    {isOverBudget ? `-${formatCents(overBudgetAmount)}` : `+${formatCents(unbudgetedAmount)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{periodLabels[breakdownPeriod]}</p>
                </div>
              );
            })()
          )}
        </div>

        {/* No income warning or chart */}
        {!expectedIncome ? (
          <div className="mt-4 text-sm text-muted-foreground">
            {budgetBreakdownSegments.length > 0 ? (
              <>
                <div className="mt-4">
                  <SpendingBreakdownChart
                    segments={budgetBreakdownSegments}
                    total={chartTotal}
                    colorMap={categoryColorMap}
                    disableToggle
                    toggleableIds={['unbudgeted']}
                    hiddenSegmentIds={hiddenSegments}
                    onSegmentToggle={handleSegmentToggle}
                  />
                </div>
                <p className="mt-3 text-center text-muted-foreground">
                  Add expected income to see budget relative to income.
                </p>
              </>
            ) : (
              <p className="py-4 text-center">No budgets set yet. Set spending limits in the Budget tab to see your allocation.</p>
            )}
          </div>
        ) : budgetBreakdownSegments.length === 0 ? (
          <p className="mt-4 py-4 text-center text-sm text-muted-foreground">
            No budgets set yet. Set spending limits in the Budget tab to see your allocation.
          </p>
        ) : (
          <div className="mt-4">
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
          </div>
        )}
        </div>
      )}

      {/* Budget tab - table with categories and limits */}
      {activeTab === 'manage-budget' && (
        <>
          <Alert variant="info" className="mb-6">
            Budgets set spending limits for each category. They vary by scenario.
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

      {/* Expected Expenses tab - placeholder */}
      {activeTab === 'expected-expenses' && (
        <div className="empty-state">
          <p className="empty-state-text">Expected expenses coming soon.</p>
        </div>
      )}

      {/* Expected Income tab - placeholder */}
      {activeTab === 'expected-income' && (
        <div className="empty-state">
          <p className="empty-state-text">Expected income coming soon.</p>
        </div>
      )}

      {/* Expected Savings Contributions tab - placeholder */}
      {activeTab === 'expected-savings' && (
        <div className="empty-state">
          <p className="empty-state-text">Expected savings contributions coming soon.</p>
        </div>
      )}

      {/* Manage Scenarios tab - placeholder */}
      {activeTab === 'manage-scenarios' && (
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
    </div>
  );
}
