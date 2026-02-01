import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Pencil,
  Trash2,
  Plus,
  Target,
  PiggyBank,
  DollarSign,
  Pin,
  ChevronDown,
  ChevronRight,
  Tag,
  CheckCircle2,
  CreditCard,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BanknoteArrowUp,
} from 'lucide-react';
import { cn, formatCents } from '@/lib/utils';
import { CHART_COLORS } from '@/lib/chart-colors';
import { PageLoading } from '@/components/page-loading';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useScenarios } from '@/hooks/use-scenarios';
import { ScenarioSelector } from '@/components/scenario-selector';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useCategories } from '@/hooks/use-categories';
import { useTransactions } from '@/hooks/use-transactions';
import { useForecasts } from '@/hooks/use-forecasts';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { CategoryBudgetDialog } from '@/components/dialogs/category-budget-dialog';
import { ForecastRuleDialog } from '@/components/dialogs/forecast-rule-dialog';
import { SpendingBreakdownChart } from '@/components/charts/spending-breakdown-chart';
import { buildCategoryColorMap } from '@/lib/chart-colors';
import type { Cadence, BudgetRule, Category, ForecastRule } from '@/lib/types';

type BudgetPeriod = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

interface OutletContext {
  activeScenarioId: string | null;
}

interface CategoryRow {
  id: string;
  category: Category;
  categoryName: string;
  fixedAmount: number; // From ForecastRules type=expense
  variableAmount: number; // From BudgetRule
  totalAmount: number; // Fixed + Variable
  budgetRule: BudgetRule | null;
  fixedExpenseRules: ForecastRule[];
  canDelete: boolean; // No transactions associated
}

const FREQUENCY_PER_LABELS: Record<Cadence, string> = {
  weekly: 'per week',
  fortnightly: 'per fortnight',
  monthly: 'per month',
  quarterly: 'per quarter',
  yearly: 'per year',
};

export function BudgetPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { categories, activeCategories, isLoading: categoriesLoading, addCategory, updateCategory, deleteCategory } = useCategories();
  const { getRuleForCategory, isLoading: budgetLoading, setBudgetForCategory, deleteBudgetRule } =
    useBudgetRules(activeScenarioId);
  const { savingsGoals, isLoading: savingsLoading } = useSavingsGoals();
  const { allTransactions } = useTransactions();

  // Calculate date range for next 12 months (for expected income)
  const forecastDateRange = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const endDate = new Date(today.getFullYear() + 1, today.getMonth(), 0).toISOString().slice(0, 10);
    return { startDate, endDate };
  }, []);

  const {
    rules: forecastRules,
    savingsForecasts,
    incomeForecasts,
    isLoading: forecastsLoading,
    addRule,
    updateRule,
    deleteRule,
  } = useForecasts(
    activeScenarioId,
    forecastDateRange.startDate,
    forecastDateRange.endDate,
  );

  const isLoading = categoriesLoading || budgetLoading || forecastsLoading || savingsLoading;

  // Period state for breakdown chart
  const [breakdownPeriod, setBreakdownPeriod] = useState<BudgetPeriod>('monthly');

  // Dialog state
  const [addCategoryDialogOpen, setAddCategoryDialogOpen] = useState(false);
  const [editCategoryDialogOpen, setEditCategoryDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<CategoryRow | null>(null);
  const [focusLimit, setFocusLimit] = useState(false);

  // Forecast rule dialog state
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ForecastRule | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [ruleDialogType, setRuleDialogType] = useState<'income' | 'expense' | 'savings' | null>(null);

  // Collapsible sections state (persisted)
  const [budgetedExpensesOpen, setBudgetedExpensesOpen] = useLocalStorage('budget:budgetedExpensesOpen', false);
  const [incomeOpen, setIncomeOpen] = useLocalStorage('budget:incomeOpen', false);
  const [fixedExpensesOpen, setFixedExpensesOpen] = useLocalStorage('budget:fixedExpensesOpen', false);
  const [savingsOpen, setSavingsOpen] = useLocalStorage('budget:savingsOpen', false);

  // Chart visibility state
  const [hiddenSegments, setHiddenSegments] = useState<Set<string>>(new Set());

  // Sort state for category table
  type SortField = 'name' | 'fixed' | 'variable' | 'total';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc'); // Default desc for amounts
    }
  }, [sortField]);

  // Filter forecast rules by type
  const incomeRules = useMemo(() => forecastRules.filter(r => r.type === 'income'), [forecastRules]);
  const expenseRules = useMemo(() => forecastRules.filter(r => r.type === 'expense'), [forecastRules]);
  const savingsRules = useMemo(() => forecastRules.filter(r => r.type === 'savings'), [forecastRules]);

  // Normalize amounts to selected period
  const toPeriod = useCallback((amount: number, cadence: Cadence, period: BudgetPeriod): number => {
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

  // Calculate fixed expenses per category (from ForecastRules type=expense)
  const fixedExpensesPerCategory = useMemo(() => {
    const result: Record<string, { amount: number; rules: ForecastRule[] }> = {};

    for (const rule of expenseRules) {
      if (rule.categoryId) {
        if (!result[rule.categoryId]) {
          result[rule.categoryId] = { amount: 0, rules: [] };
        }
        // Convert to period amount
        const periodAmount = toPeriod(rule.amountCents, rule.cadence, breakdownPeriod);
        const catData = result[rule.categoryId];
        if (catData) {
          catData.amount += periodAmount;
          catData.rules.push(rule);
        }
      }
    }

    return result;
  }, [expenseRules, toPeriod, breakdownPeriod]);

  // Build category rows
  const categoryRows: CategoryRow[] = useMemo(() => {
    // Build a set of category IDs that have transactions
    const categoriesWithTransactions = new Set(
      allTransactions.filter(t => t.categoryId).map(t => t.categoryId),
    );

    const rows = categories.map((category) => {
      const budgetRule = getRuleForCategory(category.id);
      const fixedData = fixedExpensesPerCategory[category.id];
      const fixedAmount = fixedData?.amount ?? 0;
      const variableAmount = budgetRule
        ? toPeriod(budgetRule.amountCents, budgetRule.cadence, breakdownPeriod)
        : 0;

      return {
        id: category.id,
        category,
        categoryName: category.name,
        fixedAmount,
        variableAmount,
        totalAmount: fixedAmount + variableAmount,
        budgetRule,
        fixedExpenseRules: fixedData?.rules ?? [],
        canDelete: !categoriesWithTransactions.has(category.id),
      };
    });

    // Sort: archived always at bottom, then by selected field
    return rows.sort((a, b) => {
      // Archived categories always at the bottom
      if (a.category.isArchived !== b.category.isArchived) {
        return a.category.isArchived ? 1 : -1;
      }

      const multiplier = sortDirection === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'name':
          return multiplier * a.categoryName.localeCompare(b.categoryName);
        case 'fixed':
          return multiplier * (a.fixedAmount - b.fixedAmount);
        case 'variable':
          return multiplier * (a.variableAmount - b.variableAmount);
        case 'total':
          return multiplier * (a.totalAmount - b.totalAmount);
        default:
          return 0;
      }
    });
  }, [categories, allTransactions, getRuleForCategory, fixedExpensesPerCategory, toPeriod, breakdownPeriod, sortField, sortDirection]);

  // Calculate totals
  const totals = useMemo(() => {
    // Total income from forecasts (averaged to period)
    const yearlyIncome = incomeForecasts.reduce((sum, f) => sum + f.amountCents, 0);
    const periodIncome: Record<BudgetPeriod, number> = {
      weekly: Math.round(yearlyIncome / 52),
      fortnightly: Math.round(yearlyIncome / 26),
      monthly: Math.round(yearlyIncome / 12),
      quarterly: Math.round(yearlyIncome / 4),
      yearly: yearlyIncome,
    };

    // Total fixed expenses
    const totalFixed = categoryRows
      .filter(r => !r.category.isArchived)
      .reduce((sum, r) => sum + r.fixedAmount, 0);

    // Total variable budgets
    const totalVariable = categoryRows
      .filter(r => !r.category.isArchived)
      .reduce((sum, r) => sum + r.variableAmount, 0);

    // Total savings (averaged to period)
    const yearlySavings = savingsForecasts.reduce((sum, f) => sum + f.amountCents, 0);
    const periodSavings: Record<BudgetPeriod, number> = {
      weekly: Math.round(yearlySavings / 52),
      fortnightly: Math.round(yearlySavings / 26),
      monthly: Math.round(yearlySavings / 12),
      quarterly: Math.round(yearlySavings / 4),
      yearly: yearlySavings,
    };

    const income = periodIncome[breakdownPeriod];
    const savings = periodSavings[breakdownPeriod];
    const totalSpending = totalFixed + totalVariable;
    const unallocated = income - totalSpending - savings;

    return {
      income,
      fixed: totalFixed,
      variable: totalVariable,
      savings,
      totalSpending,
      unallocated,
    };
  }, [categoryRows, incomeForecasts, savingsForecasts, breakdownPeriod]);

  // Build chart segments
  // Fixed order: Fixed → Savings → Variable → Available
  // Variable is rightmost expense so it's visually clear it's the first to cut when over budget
  const budgetBreakdownSegments = useMemo(() => {
    const orderedSegments = [
      { id: 'fixed', name: 'Fixed Expenses', amount: totals.fixed },
      { id: 'savings', name: 'Savings', amount: totals.savings },
      { id: 'variable', name: 'Budgeted Expenses', amount: totals.variable },
      { id: 'available', name: 'Available', amount: totals.unallocated },
    ];

    // Filter out zero-amount segments but maintain order
    return orderedSegments.filter(s => s.amount > 0);
  }, [totals]);

  // Category color map
  const categoryColorMap = useMemo(() => {
    const map = buildCategoryColorMap(activeCategories.map((c) => c.id));
    map['fixed'] = '#f97316'; // orange-500 for fixed expenses
    map['variable'] = '#ef4444'; // red-500 for budgeted expenses
    map['savings'] = CHART_COLORS.savings;
    map['unbudgeted'] = CHART_COLORS.available;
    map['available'] = '#22c55e'; // green-500 to match income
    return map;
  }, [activeCategories]);

  // Chart total and income marker
  const { chartTotal, incomeMarkerPercent } = useMemo(() => {
    const { income } = totals;
    const totalAllocated = totals.fixed + totals.variable + totals.savings;

    if (income === 0) {
      return { chartTotal: totalAllocated, incomeMarkerPercent: undefined };
    }

    if (totalAllocated > income) {
      return {
        chartTotal: totalAllocated,
        incomeMarkerPercent: Math.round((income / totalAllocated) * 100),
      };
    }

    return { chartTotal: income, incomeMarkerPercent: undefined };
  }, [totals]);

  // Handlers
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

  const openEditCategoryDialog = useCallback((row: CategoryRow, shouldFocusLimit = false) => {
    setEditingRow(row);
    setFocusLimit(shouldFocusLimit);
    setEditCategoryDialogOpen(true);
  }, []);

  const handleEditDialogClose = useCallback((open: boolean) => {
    setEditCategoryDialogOpen(open);
    if (!open) {
      setEditingRow(null);
      setFocusLimit(false);
    }
  }, []);

  const openAddRuleDialog = useCallback((type: 'income' | 'expense' | 'savings') => {
    setEditingRule(null);
    setRuleDialogType(type);
    setRuleDialogOpen(true);
  }, []);

  const openEditRuleDialog = useCallback((rule: ForecastRule) => {
    setEditingRule(rule);
    setRuleDialogType(rule.type);
    setRuleDialogOpen(true);
  }, []);

  const handleRuleDialogClose = useCallback((open: boolean) => {
    setRuleDialogOpen(open);
    if (!open) {
      setEditingRule(null);
      setRuleDialogType(null);
    }
  }, []);

  const handleDeleteRule = useCallback((id: string) => {
    if (deletingRuleId === id) {
      deleteRule(id);
      setDeletingRuleId(null);
    } else {
      setDeletingRuleId(id);
    }
  }, [deletingRuleId, deleteRule]);

  // Get category name helper
  const getCategoryName = useCallback(
    (id: string | null) => (id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '—'),
    [categories],
  );

  // Get savings goal name helper
  const getSavingsGoalName = useCallback(
    (id: string | null) => (id ? (savingsGoals.find((g) => g.id === id)?.name ?? 'Unknown') : '—'),
    [savingsGoals],
  );

  // Close delete confirmation on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deletingRuleId) setDeletingRuleId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deletingRuleId]);

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
          <p className="page-description">Plan your spending and savings</p>
        </div>
        <div className="empty-state">
          <p className="empty-state-text">Select a scenario to configure your budget.</p>
          <Button asChild className="empty-state-action">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Use a tolerance to account for rounding when converting between periods
  // Scale with period: yearly accumulates more rounding error than weekly
  const roundingToleranceByPeriod: Record<BudgetPeriod, number> = {
    weekly: 100,      // $1
    fortnightly: 200, // $2
    monthly: 300,     // $3
    quarterly: 500,   // $5
    yearly: 1000,     // $10
  };
  const roundingTolerance = roundingToleranceByPeriod[breakdownPeriod];
  const isFullyAllocated = Math.abs(totals.unallocated) <= roundingTolerance && totals.income > 0;
  const isOvercommitted = totals.unallocated < -roundingTolerance || (totals.income === 0 && totals.totalSpending + totals.savings > 0);
  const hasAvailable = totals.unallocated > roundingTolerance && totals.income > 0;

  return (
    <div className="page-shell">
      <div className="page-header mb-8">
        <h1 className="page-title">
          <div className="page-title-icon bg-slate-500/10">
            <Target className="h-5 w-5 text-slate-500" />
          </div>
          Budget
        </h1>
        <p className="page-description">Plan your spending and savings</p>
      </div>

      {/* Period selector and scenario */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
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
        <ScenarioSelector hideLabel />
      </div>

      {/* Budget Status Hero */}
      {(totals.income > 0 || isOvercommitted) && (
        <div className="mb-6 min-h-28 text-center sm:min-h-32">
          <div className="min-h-8" />
          {isOvercommitted ? (
            <>
              <p className="flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide text-amber-500">
                <CreditCard className="h-4 w-4" />
                Overcommitted
              </p>
              <p className="mt-2 text-5xl font-bold tracking-tight text-amber-500">
                {formatCents(Math.abs(totals.unallocated))}
              </p>
              <div className="mx-auto mt-4 mb-3 h-px w-24 bg-border" />
              <p className="text-sm text-muted-foreground">
                {totals.income > 0 ? `Over budget ${FREQUENCY_PER_LABELS[breakdownPeriod]} on average` : 'Add income to cover your planned expenses and savings'}
              </p>
            </>
          ) : isFullyAllocated ? (
            <>
              <p className="flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide text-green-500">
                <CheckCircle2 className="h-4 w-4" />
                Budget Balanced
              </p>
              <p className="mt-2 text-5xl font-bold tracking-tight text-green-500">
                {formatCents(totals.income)}
              </p>
              <div className="mx-auto mt-4 mb-3 h-px w-24 bg-border" />
              <p className="text-sm text-muted-foreground">
                Every dollar accounted for
              </p>
            </>
          ) : hasAvailable ? (
            <>
              <p className="flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide text-green-500">
                <CheckCircle2 className="h-4 w-4" />
                Surplus
              </p>
              <p className="mt-2 text-5xl font-bold tracking-tight text-green-500">
                {formatCents(totals.unallocated)}
              </p>
              <div className="mx-auto mt-4 mb-3 h-px w-24 bg-border" />
              <p className="text-sm text-muted-foreground">
                {Math.round((totals.unallocated / totals.income) * 100)}% of income not being spent or saved
              </p>
            </>
          ) : null}
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Income Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
              <DollarSign className="h-4 w-4 text-green-500" />
            </div>
            <span className="text-sm text-muted-foreground">Income</span>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {totals.income > 0 ? formatCents(totals.income) : '—'}
          </p>
          {totals.income > 0 && (
            <p className="text-sm text-muted-foreground">
              {incomeRules.length} source{incomeRules.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Fixed Expenses Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/10">
              <Pin className="h-4 w-4 text-orange-500" />
            </div>
            <span className="text-sm text-muted-foreground">Fixed Expenses</span>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {totals.fixed > 0 ? formatCents(totals.fixed) : '—'}
          </p>
          {totals.income > 0 && totals.fixed > 0 && (
            <p className="text-sm text-muted-foreground">
              {Math.round((totals.fixed / totals.income) * 100)}% of income
            </p>
          )}
        </div>

        {/* Budgeted Expenses Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
              <Target className="h-4 w-4 text-red-500" />
            </div>
            <span className="text-sm text-muted-foreground">Budgeted Expenses</span>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {totals.variable > 0 ? formatCents(totals.variable) : '—'}
          </p>
          {totals.income > 0 && totals.variable > 0 && (
            <p className="text-sm text-muted-foreground">
              {Math.round((totals.variable / totals.income) * 100)}% of income
            </p>
          )}
        </div>

        {/* Savings Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10">
              <PiggyBank className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-sm text-muted-foreground">Savings</span>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {totals.savings > 0 ? formatCents(totals.savings) : '—'}
          </p>
          {totals.income > 0 && totals.savings > 0 && (
            <p className="text-sm text-muted-foreground">
              {Math.round((totals.savings / totals.income) * 100)}% of income
            </p>
          )}
        </div>
      </div>

      {/* Allocation Chart */}
      {budgetBreakdownSegments.length > 0 && (
        <div className="mb-8 rounded-xl border bg-card p-5">
          <h3 className="mb-2 text-lg font-semibold">Income Allocation</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            How your {formatCents(totals.income)} income is allocated
          </p>
          <SpendingBreakdownChart
            segments={budgetBreakdownSegments}
            total={chartTotal}
            colorMap={categoryColorMap}
            disableToggle
            toggleableIds={['available']}
            hiddenSegmentIds={hiddenSegments}
            onSegmentToggle={handleSegmentToggle}
            {...(incomeMarkerPercent !== undefined && { incomeMarker: incomeMarkerPercent })}
          />
        </div>
      )}

      {/* Income Sources Section */}
      <Collapsible open={incomeOpen} onOpenChange={setIncomeOpen} className="mb-4">
        <div className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between bg-card p-4">
            <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-2">
              {incomeOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <BanknoteArrowUp className="h-4 w-4 text-green-500" />
              <span className="font-medium">Income Sources</span>
              <span className="text-sm text-muted-foreground">
                {incomeRules.length} source{incomeRules.length !== 1 ? 's' : ''} totaling {formatCents(totals.income)} {FREQUENCY_PER_LABELS[breakdownPeriod]}
              </span>
            </CollapsibleTrigger>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openAddRuleDialog('income'); }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <CollapsibleContent>
            {incomeRules.length === 0 ? (
              <p className="border-t bg-card py-4 text-center text-sm text-muted-foreground">
                No income sources yet.{' '}
                <button onClick={() => openAddRuleDialog('income')} className="cursor-pointer text-primary hover:underline">
                  Add one
                </button>
              </p>
            ) : (
              <table className="w-full">
                <tbody className="divide-y border-t">
                  {incomeRules.map((rule) => (
                    <tr key={rule.id} className="bg-card transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{rule.description}</td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                        {formatCents(rule.amountCents)} {FREQUENCY_PER_LABELS[rule.cadence]}
                      </td>
                      <td className="w-20 px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => openEditRuleDialog(rule)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={deletingRuleId === rule.id ? 'destructive' : 'ghost'}
                                  size="sm"
                                  onClick={() => handleDeleteRule(rule.id)}
                                  onBlur={() => setTimeout(() => setDeletingRuleId(null), 200)}
                                >
                                  {deletingRuleId === rule.id ? 'Confirm' : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{deletingRuleId === rule.id ? 'Click to confirm' : 'Delete'}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Fixed Expenses Section */}
      <Collapsible open={fixedExpensesOpen} onOpenChange={setFixedExpensesOpen} className="mb-4">
        <div className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between bg-card p-4">
            <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-2">
              {fixedExpensesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Pin className="h-4 w-4 text-orange-500" />
              <span className="font-medium">Fixed Expenses</span>
              <span className="text-sm text-muted-foreground">
                {expenseRules.length} expense{expenseRules.length !== 1 ? 's' : ''} totaling {formatCents(totals.fixed)} {FREQUENCY_PER_LABELS[breakdownPeriod]}
              </span>
            </CollapsibleTrigger>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openAddRuleDialog('expense'); }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <CollapsibleContent>
            {expenseRules.length === 0 ? (
              <p className="border-t bg-card py-4 text-center text-sm text-muted-foreground">
                No fixed expenses yet.{' '}
                <button onClick={() => openAddRuleDialog('expense')} className="cursor-pointer text-primary hover:underline">
                  Add one
                </button>
              </p>
            ) : (
              <table className="w-full">
                <tbody className="divide-y border-t">
                  {expenseRules.map((rule) => (
                    <tr key={rule.id} className="bg-card transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{rule.description}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {rule.categoryId ? getCategoryName(rule.categoryId) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                        {formatCents(rule.amountCents)} {FREQUENCY_PER_LABELS[rule.cadence]}
                      </td>
                      <td className="w-20 px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => openEditRuleDialog(rule)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={deletingRuleId === rule.id ? 'destructive' : 'ghost'}
                                  size="sm"
                                  onClick={() => handleDeleteRule(rule.id)}
                                  onBlur={() => setTimeout(() => setDeletingRuleId(null), 200)}
                                >
                                  {deletingRuleId === rule.id ? 'Confirm' : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{deletingRuleId === rule.id ? 'Click to confirm' : 'Delete'}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Budgeted Expenses */}
      <Collapsible open={budgetedExpensesOpen} onOpenChange={setBudgetedExpensesOpen} className="mb-4">
        <div className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between bg-card p-4">
            <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-2">
              {budgetedExpensesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Target className="h-4 w-4 text-red-500" />
              <span className="font-medium">Budgeted Expenses</span>
              <span className="text-sm text-muted-foreground">
                {categoryRows.filter(r => !r.category.isArchived && r.variableAmount > 0).length} categories totaling {formatCents(totals.variable)} {FREQUENCY_PER_LABELS[breakdownPeriod]}
              </span>
            </CollapsibleTrigger>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setAddCategoryDialogOpen(true); }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <CollapsibleContent>
        {categoryRows.length === 0 ? (
          <p className="border-t bg-card py-4 text-center text-sm text-muted-foreground">
            No categories yet.{' '}
            <button onClick={() => setAddCategoryDialogOpen(true)} className="cursor-pointer text-primary hover:underline">
              Add one
            </button>
          </p>
        ) : (
            <table className="w-full">
              <thead className="border-t bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('name')}
                      className="flex cursor-pointer items-center gap-1 hover:text-foreground"
                    >
                      Category
                      {sortField === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('variable')}
                      className="ml-auto flex cursor-pointer items-center gap-1 hover:text-foreground"
                    >
                      Budget
                      {sortField === 'variable' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="w-20 px-4 py-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {categoryRows.map((row) => {
                  const isArchived = row.category.isArchived;
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'transition-colors hover:bg-muted/50',
                        isArchived && 'opacity-50',
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link
                                  to={`/categories/${row.id}`}
                                  className="font-medium hover:underline"
                                >
                                  {row.categoryName}
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent>View category details</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {isArchived && <Badge variant="secondary">Archived</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.variableAmount > 0 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => openEditCategoryDialog(row, true)}
                                  className="cursor-pointer font-mono hover:underline"
                                >
                                  {formatCents(row.variableAmount)}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Edit budget</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => openEditCategoryDialog(row, true)}
                                  className="cursor-pointer text-muted-foreground hover:underline hover:text-foreground"
                                >
                                  —
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Set a budget</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditCategoryDialog(row)}
                                  aria-label="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit category</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        )}
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Savings Contributions Section */}
      <Collapsible open={savingsOpen} onOpenChange={setSavingsOpen}>
        <div className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between bg-card p-4">
            <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-2">
              {savingsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <PiggyBank className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Savings Contributions</span>
              <span className="text-sm text-muted-foreground">
                {savingsRules.length} contribution{savingsRules.length !== 1 ? 's' : ''} totaling {formatCents(totals.savings)} {FREQUENCY_PER_LABELS[breakdownPeriod]}
              </span>
            </CollapsibleTrigger>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openAddRuleDialog('savings'); }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <CollapsibleContent>
            {savingsRules.length === 0 ? (
              <p className="border-t bg-card py-4 text-center text-sm text-muted-foreground">
                No savings contributions yet.{' '}
                <button onClick={() => openAddRuleDialog('savings')} className="cursor-pointer text-primary hover:underline">
                  Add one
                </button>
              </p>
            ) : (
              <table className="w-full">
                <tbody className="divide-y border-t">
                  {savingsRules.map((rule) => (
                    <tr key={rule.id} className="bg-card transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">
                        {rule.savingsGoalId ? getSavingsGoalName(rule.savingsGoalId) : 'Savings'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                        {formatCents(rule.amountCents)} {FREQUENCY_PER_LABELS[rule.cadence]}
                      </td>
                      <td className="w-20 px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => openEditRuleDialog(rule)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={deletingRuleId === rule.id ? 'destructive' : 'ghost'}
                                  size="sm"
                                  onClick={() => handleDeleteRule(rule.id)}
                                  onBlur={() => setTimeout(() => setDeletingRuleId(null), 200)}
                                >
                                  {deletingRuleId === rule.id ? 'Confirm' : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{deletingRuleId === rule.id ? 'Click to confirm' : 'Delete'}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Add Category Dialog */}
      <CategoryBudgetDialog
        open={addCategoryDialogOpen}
        onOpenChange={setAddCategoryDialogOpen}
        scenarioId={activeScenarioId}
        unallocatedAmount={totals.unallocated}
        hasIncome={totals.income > 0}
        addCategory={addCategory}
        setBudgetForCategory={setBudgetForCategory}
      />

      {/* Edit Category Dialog */}
      {editingRow && (
        <CategoryBudgetDialog
          open={editCategoryDialogOpen}
          onOpenChange={handleEditDialogClose}
          scenarioId={activeScenarioId}
          category={editingRow.category}
          existingRule={editingRow.budgetRule}
          focusLimit={focusLimit}
          canDeleteCategory={editingRow.canDelete}
          unallocatedAmount={totals.unallocated}
          hasIncome={totals.income > 0}
          addCategory={addCategory}
          updateCategory={updateCategory}
          deleteCategory={deleteCategory}
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
        restrictType={ruleDialogType}
      />
    </div>
  );
}
