import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PiggyBank,
  CreditCard,
  Scale,
  Banknote,
  BanknoteArrowUp,
  BanknoteArrowDown,
  ChartPie,
  Sparkles,
} from 'lucide-react';
import { cn, formatCents, toMonthlyCents, type CadenceType } from '@/lib/utils';
import { CHART_COLORS } from '@/lib/chart-colors';
import { useScenarios } from '@/hooks/use-scenarios';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useForecasts } from '@/hooks/use-forecasts';
import { useAdjustedBudgets, useAdjustedForecasts } from '@/hooks/use-adjusted-values';
import { useCategories } from '@/hooks/use-categories';
import { useTransactions } from '@/hooks/use-transactions';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CategoryBudgetDialog } from '@/components/dialogs/category-budget-dialog';
import { ForecastRuleDialog } from '@/components/dialogs/forecast-rule-dialog';
import { SpendingBreakdownChart } from '@/components/charts/spending-breakdown-chart';
import { buildCategoryColorMap } from '@/lib/chart-colors';
import {
  IncomeSliderSection,
  FixedExpenseSliderSection,
  BudgetedSpendingSliderSection,
  SavingsSliderSection,
} from '@/components/budget/slider-sections';
import { useWhatIf } from '@/contexts/what-if-context';
import { useScenarioDiff } from '@/hooks/use-scenario-diff';
import { ScenarioDelta } from '@/components/ui/scenario-delta';
import type { Cadence, BudgetRule, Category, ForecastRule } from '@/lib/types';

type BudgetPeriod = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

const FREQUENCY_PER_LABELS: Record<Cadence, string> = {
  weekly: 'per week',
  fortnightly: 'per fortnight',
  monthly: 'per month',
  quarterly: 'per quarter',
  yearly: 'per year',
};

interface CategoryRow {
  id: string;
  category: Category;
  categoryName: string;
  fixedAmount: number;
  variableAmount: number;
  totalAmount: number;
  budgetRule: BudgetRule | null;
  fixedExpenseRules: ForecastRule[];
  canDelete: boolean;
}

interface PlanTabProps {
  activeScenarioId: string;
}

export function PlanTab({ activeScenarioId }: PlanTabProps) {
  const { activeScenario } = useScenarios();
  const { isWhatIfMode } = useWhatIf();
  const { getTotalDelta, isViewingDefault } = useScenarioDiff();
  const showDeltas = !isViewingDefault || isWhatIfMode;
  const {
    categories,
    activeCategories,
    isLoading: categoriesLoading,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useCategories();
  const {
    getRuleForCategory,
    isLoading: budgetLoading,
    setBudgetForCategory,
    deleteBudgetRule,
    restoreBudgetRule,
  } = useBudgetRules(activeScenarioId);
  const { budgetRules } = useAdjustedBudgets(activeScenarioId);
  const { savingsGoals, isLoading: savingsLoading } = useSavingsGoals();
  const { allTransactions, isLoading: transactionsLoading } = useTransactions();

  const forecastDateRange = useMemo(() => {
    const today = new Date();
    const startDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const endDay = new Date(today.getFullYear() + 1, today.getMonth(), 0);
    const startDate = `${startDay.getFullYear()}-${String(startDay.getMonth() + 1).padStart(2, '0')}-${String(startDay.getDate()).padStart(2, '0')}`;
    const endDate = `${endDay.getFullYear()}-${String(endDay.getMonth() + 1).padStart(2, '0')}-${String(endDay.getDate()).padStart(2, '0')}`;
    return { startDate, endDate };
  }, []);

  const {
    rules: forecastRules,
    isLoading: forecastsLoading,
    addRule,
    updateRule,
    deleteRule,
    restoreRule,
  } = useForecasts(activeScenarioId, forecastDateRange.startDate, forecastDateRange.endDate);

  const {
    rules: adjustedForecastRules,
    savingsForecasts,
    incomeForecasts,
  } = useAdjustedForecasts(
    activeScenarioId,
    forecastDateRange.startDate,
    forecastDateRange.endDate,
  );

  const isLoading =
    categoriesLoading || budgetLoading || forecastsLoading || savingsLoading || transactionsLoading;

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
  const [ruleDialogType, setRuleDialogType] = useState<'income' | 'expense' | 'savings' | null>(
    null,
  );

  // Budget auto-update confirmation
  const [budgetConfirmation, setBudgetConfirmation] = useState<{
    categoryName: string;
    message: string;
  } | null>(null);

  // Undo-wrapped delete for forecast rules
  const handleDeleteForecastRule = useCallback(
    async (ruleId: string) => {
      const rule = forecastRules.find((r) => r.id === ruleId);
      if (!rule) return;
      await deleteRule(ruleId);
      toast('Recurring forecast deleted', {
        action: {
          label: 'Undo',
          onClick: () => {
            restoreRule(rule);
          },
        },
        duration: 5000,
      });
    },
    [forecastRules, deleteRule, restoreRule],
  );

  // Undo-wrapped delete for budget rules
  const handleDeleteBudgetRule = useCallback(
    async (ruleId: string) => {
      const rule = budgetRules.find((r) => r.id === ruleId);
      if (!rule) return;
      await deleteBudgetRule(ruleId);
      toast('Budget removed', {
        action: {
          label: 'Undo',
          onClick: () => {
            restoreBudgetRule(rule);
          },
        },
        duration: 5000,
      });
    },
    [budgetRules, deleteBudgetRule, restoreBudgetRule],
  );

  const handleExpenseRuleCreated = useCallback(
    async (rule: ForecastRule) => {
      if (rule.type !== 'expense' || !rule.categoryId) return;

      const category = categories.find((c) => c.id === rule.categoryId);
      const categoryName = category?.name ?? 'Unknown';
      const ruleMonthly = toMonthlyCents(rule.amountCents, rule.cadence as CadenceType);
      const existing = getRuleForCategory(rule.categoryId);

      if (existing) {
        const existingMonthly = toMonthlyCents(
          existing.amountCents,
          existing.cadence as CadenceType,
        );
        const newTotal = existingMonthly + ruleMonthly;
        await setBudgetForCategory(rule.categoryId, newTotal, 'monthly');
        setBudgetConfirmation({
          categoryName,
          message: `Budget for ${categoryName} increased from ${formatCents(existingMonthly)} per month to ${formatCents(newTotal)} per month to include this expense.`,
        });
      } else {
        await setBudgetForCategory(rule.categoryId, ruleMonthly, 'monthly');
        setBudgetConfirmation({
          categoryName,
          message: `A ${formatCents(ruleMonthly)} per month budget has been created for ${categoryName} to cover this expense.`,
        });
      }
    },
    [categories, getRuleForCategory, setBudgetForCategory],
  );

  // Collapsible sections state (persisted)
  const [budgetedExpensesOpen, setBudgetedExpensesOpen] = useLocalStorage(
    'budget:budgetedExpensesOpen',
    false,
  );
  const [incomeOpen, setIncomeOpen] = useLocalStorage('budget:incomeOpen', false);
  const [fixedExpensesOpen, setFixedExpensesOpen] = useLocalStorage(
    'budget:fixedExpensesOpen',
    false,
  );
  const [savingsOpen, setSavingsOpen] = useLocalStorage('budget:savingsOpen', false);

  // Chart visibility state
  const [hiddenSegments, setHiddenSegments] = useState<Set<string>>(new Set());

  // Filter forecast rules by type (base rules for slider sections)
  const incomeRules = useMemo(
    () => forecastRules.filter((r) => r.type === 'income'),
    [forecastRules],
  );
  const expenseRules = useMemo(
    () => forecastRules.filter((r) => r.type === 'expense'),
    [forecastRules],
  );
  const savingsRules = useMemo(
    () => forecastRules.filter((r) => r.type === 'savings'),
    [forecastRules],
  );

  // Adjusted expense rules for display calculations
  const adjustedExpenseRules = useMemo(
    () => adjustedForecastRules.filter((r) => r.type === 'expense'),
    [adjustedForecastRules],
  );

  // Normalize amounts to selected period
  const toPeriod = useCallback((amount: number, cadence: Cadence, period: BudgetPeriod): number => {
    let yearly: number;
    switch (cadence) {
      case 'weekly':
        yearly = amount * 52;
        break;
      case 'fortnightly':
        yearly = amount * 26;
        break;
      case 'monthly':
        yearly = amount * 12;
        break;
      case 'quarterly':
        yearly = amount * 4;
        break;
      case 'yearly':
        yearly = amount;
        break;
    }
    switch (period) {
      case 'weekly':
        return Math.round(yearly / 52);
      case 'fortnightly':
        return Math.round(yearly / 26);
      case 'monthly':
        return Math.round(yearly / 12);
      case 'quarterly':
        return Math.round(yearly / 4);
      case 'yearly':
        return yearly;
    }
  }, []);

  // Calculate fixed expenses per category
  const fixedExpensesPerCategory = useMemo(() => {
    const result: Record<string, { amount: number; rules: ForecastRule[] }> = {};

    for (const rule of adjustedExpenseRules) {
      if (rule.categoryId) {
        if (!result[rule.categoryId]) {
          result[rule.categoryId] = { amount: 0, rules: [] };
        }
        const periodAmount = toPeriod(rule.amountCents, rule.cadence, breakdownPeriod);
        const catData = result[rule.categoryId];
        if (catData) {
          catData.amount += periodAmount;
          catData.rules.push(rule);
        }
      }
    }

    return result;
  }, [adjustedExpenseRules, toPeriod, breakdownPeriod]);

  // Build category rows
  const categoryRows: CategoryRow[] = useMemo(() => {
    const categoriesWithTransactions = new Set(
      allTransactions.filter((t) => t.categoryId).map((t) => t.categoryId),
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

    return rows.sort((a, b) => {
      if (a.category.isArchived !== b.category.isArchived) {
        return a.category.isArchived ? 1 : -1;
      }
      return a.categoryName.localeCompare(b.categoryName);
    });
  }, [
    categories,
    allTransactions,
    getRuleForCategory,
    fixedExpensesPerCategory,
    toPeriod,
    breakdownPeriod,
  ]);

  // Calculate totals
  const totals = useMemo(() => {
    const yearlyIncome = incomeForecasts.reduce((sum, f) => sum + f.amountCents, 0);
    const periodIncome: Record<BudgetPeriod, number> = {
      weekly: Math.round(yearlyIncome / 52),
      fortnightly: Math.round(yearlyIncome / 26),
      monthly: Math.round(yearlyIncome / 12),
      quarterly: Math.round(yearlyIncome / 4),
      yearly: yearlyIncome,
    };

    const totalFixed = categoryRows
      .filter((r) => !r.category.isArchived)
      .reduce((sum, r) => sum + r.fixedAmount, 0);

    const totalVariable = categoryRows
      .filter((r) => !r.category.isArchived)
      .reduce((sum, r) => sum + r.variableAmount, 0);

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

    // Monthly totals for scenario comparison
    const monthlyIncome = periodIncome.monthly;
    const monthlyFixed = Math.round(
      categoryRows
        .filter((r) => !r.category.isArchived)
        .reduce((sum, r) => {
          const yearly =
            r.fixedAmount *
            (breakdownPeriod === 'weekly'
              ? 52
              : breakdownPeriod === 'fortnightly'
                ? 26
                : breakdownPeriod === 'monthly'
                  ? 12
                  : breakdownPeriod === 'quarterly'
                    ? 4
                    : 1);
          return sum + yearly / 12;
        }, 0),
    );
    const monthlyVariable = Math.round(
      categoryRows
        .filter((r) => !r.category.isArchived)
        .reduce((sum, r) => {
          const yearly =
            r.variableAmount *
            (breakdownPeriod === 'weekly'
              ? 52
              : breakdownPeriod === 'fortnightly'
                ? 26
                : breakdownPeriod === 'monthly'
                  ? 12
                  : breakdownPeriod === 'quarterly'
                    ? 4
                    : 1);
          return sum + yearly / 12;
        }, 0),
    );
    const monthlySavings = periodSavings.monthly;
    const monthlySurplus = monthlyIncome - monthlyFixed - monthlyVariable - monthlySavings;

    return {
      income,
      fixed: totalFixed,
      variable: totalVariable,
      savings,
      totalSpending,
      unallocated,
      monthlyIncome,
      monthlyFixed,
      monthlyVariable,
      monthlySavings,
      monthlySurplus,
    };
  }, [categoryRows, incomeForecasts, savingsForecasts, breakdownPeriod]);

  // Build chart segments
  const budgetBreakdownSegments = useMemo(() => {
    const orderedSegments = [
      { id: 'fixed', name: 'Fixed Expenses', amount: totals.fixed },
      { id: 'savings', name: 'Savings', amount: totals.savings },
      { id: 'variable', name: 'Budgeted Expenses', amount: totals.variable },
      { id: 'surplus', name: 'Surplus', amount: totals.unallocated },
    ];

    return orderedSegments.filter((s) => s.amount > 0);
  }, [totals]);

  // Category color map
  const categoryColorMap = useMemo(() => {
    const map = buildCategoryColorMap(activeCategories.map((c) => c.id));
    map['fixed'] = '#b91c1c';
    map['variable'] = '#ef4444';
    map['savings'] = CHART_COLORS.savings;
    map['unbudgeted'] = CHART_COLORS.available;
    map['surplus'] = '#22c55e';
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

  const handleEditBudgetRule = useCallback(
    (rule: BudgetRule) => {
      const row = categoryRows.find((r) => r.budgetRule?.id === rule.id);
      if (row) {
        openEditCategoryDialog(row, true);
      }
    },
    [categoryRows, openEditCategoryDialog],
  );

  const handleRuleDialogClose = useCallback((open: boolean) => {
    setRuleDialogOpen(open);
    if (!open) {
      setEditingRule(null);
      setRuleDialogType(null);
    }
  }, []);

  if (isLoading) {
    return null;
  }

  // Use a tolerance to account for rounding when converting between periods
  const roundingToleranceByPeriod: Record<BudgetPeriod, number> = {
    weekly: 100,
    fortnightly: 200,
    monthly: 300,
    quarterly: 500,
    yearly: 1000,
  };
  const roundingTolerance = roundingToleranceByPeriod[breakdownPeriod];
  const isFullyAllocated = Math.abs(totals.unallocated) <= roundingTolerance && totals.income > 0;
  const isOvercommitted =
    totals.unallocated < -roundingTolerance ||
    (totals.income === 0 && totals.totalSpending + totals.savings > 0);
  const hasAvailable = totals.unallocated > roundingTolerance && totals.income > 0;

  return (
    <div>
      {/* Period selector */}
      <div className="mb-6">
        <Select
          value={breakdownPeriod}
          onValueChange={(v) => setBreakdownPeriod(v as BudgetPeriod)}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Per week</SelectItem>
            <SelectItem value="fortnightly">Per fortnight</SelectItem>
            <SelectItem value="monthly">Per month</SelectItem>
            <SelectItem value="quarterly">Per quarter</SelectItem>
            <SelectItem value="yearly">Per year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Budget Status Hero */}
      {(totals.income > 0 || isOvercommitted) && (
        <div className="mb-4 min-h-28 text-center sm:min-h-32">
          <div className="flex min-h-8 items-center justify-center">
            <span className="flex items-center gap-1 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-600 dark:text-violet-400">
              <Sparkles className="h-3 w-3" />
              {activeScenario?.name ?? 'Default'}
            </span>
          </div>
          {isOvercommitted ? (
            <div className="mt-4">
              <p className="flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide text-amber-500">
                <CreditCard className="h-4 w-4" />
                Planned Shortfall
              </p>
              <p className="mt-2 text-5xl font-bold tracking-tight text-amber-500">
                {formatCents(Math.abs(totals.unallocated))}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {totals.income === 0
                  ? 'Add income to cover your planned expenses and savings'
                  : FREQUENCY_PER_LABELS[breakdownPeriod]}
              </p>
              <div className="mx-auto mt-4 mb-3 h-px w-24 bg-border" />
              <ScenarioDelta
                delta={getTotalDelta('surplus', totals.monthlySurplus)}
                show={showDeltas}
              />
            </div>
          ) : isFullyAllocated ? (
            <div className="mt-4">
              <p className="flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide text-green-500">
                <Scale className="h-4 w-4" />
                Budget Balanced
              </p>
              <p className="mt-2 text-5xl font-bold tracking-tight text-green-500">
                Every dollar accounted for
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {FREQUENCY_PER_LABELS[breakdownPeriod]}
              </p>
              <div className="mx-auto mt-4 mb-3 h-px w-24 bg-border" />
              <ScenarioDelta
                delta={getTotalDelta('surplus', totals.monthlySurplus)}
                show={showDeltas}
              />
            </div>
          ) : hasAvailable ? (
            <div className="mt-4">
              <p className="flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide text-green-500">
                <Banknote className="h-4 w-4" />
                Planned Surplus
              </p>
              <p className="mt-2 text-5xl font-bold tracking-tight text-green-500">
                {formatCents(totals.unallocated)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {FREQUENCY_PER_LABELS[breakdownPeriod]}
              </p>
              <div className="mx-auto mt-4 mb-3 h-px w-24 bg-border" />
              <ScenarioDelta
                delta={getTotalDelta('surplus', totals.monthlySurplus)}
                show={showDeltas}
              />
            </div>
          ) : null}
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Income Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
              <BanknoteArrowUp className="h-4 w-4 text-green-500" />
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
          <ScenarioDelta delta={getTotalDelta('income', totals.monthlyIncome)} show={showDeltas} />
        </div>

        {/* Fixed Expenses Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
              <BanknoteArrowDown className="h-4 w-4 text-red-500" />
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
          <ScenarioDelta delta={getTotalDelta('fixed', totals.monthlyFixed)} show={showDeltas} />
        </div>

        {/* Budgeted Expenses Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
              <BanknoteArrowDown className="h-4 w-4 text-red-500" />
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
          <ScenarioDelta
            delta={getTotalDelta('budget', totals.monthlyVariable)}
            show={showDeltas}
          />
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
          <ScenarioDelta
            delta={getTotalDelta('savings', totals.monthlySavings)}
            show={showDeltas}
          />
        </div>
      </div>

      {/* Breakdown Chart */}
      {budgetBreakdownSegments.length > 0 &&
        (() => {
          const surplusHidden = hiddenSegments.has('surplus');
          const budgetTotal = totals.fixed + totals.savings + totals.variable;
          const segmentDeltas = showDeltas
            ? {
                fixed: getTotalDelta('fixed', totals.monthlyFixed),
                savings: getTotalDelta('savings', totals.monthlySavings),
                variable: getTotalDelta('budget', totals.monthlyVariable),
                surplus: getTotalDelta('surplus', totals.monthlySurplus),
              }
            : undefined;
          return (
            <div
              className={cn(
                'mb-8 rounded-xl border bg-card p-5',
                showDeltas && 'border-violet-500/30',
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <ChartPie className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">
                  {surplusHidden ? 'Budget Breakdown' : 'Income Breakdown'}
                </h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                {surplusHidden ? (
                  `How your ${formatCents(budgetTotal)} budget is allocated`
                ) : (
                  <>
                    How your {formatCents(totals.income)}
                    {(() => {
                      const incomeDelta = showDeltas
                        ? getTotalDelta('income', totals.monthlyIncome)
                        : 0;
                      return (
                        <span
                          className={incomeDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : 'hidden'}
                        >
                          {' '}
                          ({incomeDelta > 0 ? '+' : ''}
                          {formatCents(incomeDelta)})
                        </span>
                      );
                    })()}{' '}
                    income is allocated
                  </>
                )}
              </p>
              <SpendingBreakdownChart
                segments={budgetBreakdownSegments}
                total={surplusHidden ? budgetTotal : chartTotal}
                colorMap={categoryColorMap}
                disableToggle
                toggleableIds={['surplus']}
                hiddenSegmentIds={hiddenSegments}
                onSegmentToggle={handleSegmentToggle}
                showDollarAmountIds={surplusHidden ? ['surplus'] : []}
                segmentDeltas={segmentDeltas}
                {...(incomeMarkerPercent !== undefined &&
                  !surplusHidden && { incomeMarker: incomeMarkerPercent })}
              />
            </div>
          );
        })()}

      {/* Your Plan Divider */}
      <div className="flex items-center gap-4 py-6">
        <div className="h-px flex-1 bg-border" />
        <span className="text-sm font-medium text-muted-foreground">Your Plan</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Income Sources Section */}
      <IncomeSliderSection
        incomeRules={incomeRules}
        isOpen={incomeOpen}
        onOpenChange={setIncomeOpen}
        onAddClick={() => openAddRuleDialog('income')}
        onEditRule={openEditRuleDialog}
        onDeleteRule={handleDeleteForecastRule}
        periodLabel={FREQUENCY_PER_LABELS[breakdownPeriod]}
        periodTotal={totals.income}
        monthlyDelta={showDeltas ? getTotalDelta('income', totals.monthlyIncome) : undefined}
      />

      {/* Fixed Expenses Section */}
      <FixedExpenseSliderSection
        expenseRules={expenseRules}
        categories={categories}
        isOpen={fixedExpensesOpen}
        onOpenChange={setFixedExpensesOpen}
        onAddClick={() => openAddRuleDialog('expense')}
        onEditRule={openEditRuleDialog}
        onDeleteRule={handleDeleteForecastRule}
        periodLabel={FREQUENCY_PER_LABELS[breakdownPeriod]}
        periodTotal={totals.fixed}
        monthlyDelta={showDeltas ? getTotalDelta('fixed', totals.monthlyFixed) : undefined}
      />

      {/* Budgeted Expenses */}
      <BudgetedSpendingSliderSection
        budgetRules={budgetRules}
        categories={categories}
        isOpen={budgetedExpensesOpen}
        onOpenChange={setBudgetedExpensesOpen}
        onAddClick={() => setAddCategoryDialogOpen(true)}
        onEditBudget={handleEditBudgetRule}
        onDeleteBudget={handleDeleteBudgetRule}
        periodLabel={FREQUENCY_PER_LABELS[breakdownPeriod]}
        periodTotal={totals.variable}
        monthlyDelta={showDeltas ? getTotalDelta('budget', totals.monthlyVariable) : undefined}
      />

      {/* Savings Contributions Section */}
      <SavingsSliderSection
        savingsRules={savingsRules}
        savingsGoals={savingsGoals}
        isOpen={savingsOpen}
        onOpenChange={setSavingsOpen}
        onAddClick={() => openAddRuleDialog('savings')}
        onEditRule={openEditRuleDialog}
        onDeleteRule={handleDeleteForecastRule}
        periodLabel={FREQUENCY_PER_LABELS[breakdownPeriod]}
        periodTotal={totals.savings}
        monthlyDelta={showDeltas ? getTotalDelta('savings', totals.monthlySavings) : undefined}
      />

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
        onRuleCreated={handleExpenseRuleCreated}
        restrictType={ruleDialogType}
        existingRules={forecastRules}
      />

      {/* Budget auto-update confirmation */}
      <AlertDialog
        open={!!budgetConfirmation}
        onOpenChange={(open) => !open && setBudgetConfirmation(null)}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Budget Updated</AlertDialogTitle>
            <AlertDialogDescription>{budgetConfirmation?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setBudgetConfirmation(null)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
