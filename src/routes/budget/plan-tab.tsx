import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { PiggyBank, BanknoteArrowUp, BanknoteArrowDown, ChartPie } from 'lucide-react';
import { cn, formatCents, formatISODate } from '@/lib/utils';
import { averageMonthlySpendingByCategory } from '@/lib/spending-averages';
import { CHART_COLORS } from '@/lib/chart-colors';
import { sumForecastRulesForPeriod, toPeriodCents } from '@/lib/plan-amounts';
import { sumAllowancesForPeriod } from '@/lib/allowances';
import { useScenarios } from '@/hooks/use-scenarios';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useForecasts } from '@/hooks/use-forecasts';
import { useAdjustedBudgets, useAdjustedForecasts } from '@/hooks/use-adjusted-values';
import { useCategories } from '@/hooks/use-categories';
import { useTransactions } from '@/hooks/use-transactions';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { ExpenseDialog } from '@/components/dialogs/expense-dialog';
import {
  ForecastRuleDialog,
  type RecurringRuleType,
} from '@/components/dialogs/forecast-rule-dialog';
import { SpendingBreakdownChart } from '@/components/charts/spending-breakdown-chart';
import { BudgetStatusHero } from '@/components/budget/status-hero';
import { BudgetSummaryCard } from '@/components/budget/summary-card';
import { buildCategoryColorMap } from '@/lib/chart-colors';
import {
  IncomeSliderSection,
  ExpensesSliderSection,
  SavingsSliderSection,
} from '@/components/budget/slider-sections';
import { useWhatIf } from '@/contexts/what-if-context';
import { useScenarioDiff } from '@/hooks/use-scenario-diff';
import type { Expense, NewExpense } from '@/lib/expenses';
import { replaceExpenseWithOtherKind } from '@/lib/replace-expense';
import type { Cadence, Category, ForecastRule, ForecastType } from '@/lib/types';

type BudgetPeriod = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

const EXPENSE_REMOVED_MESSAGE = 'Expense removed';

// Toast shown after deleting a forecast rule, by what the user calls that type
const DELETED_RULE_MESSAGES: Record<ForecastType, string> = {
  income: 'Income deleted',
  expense: EXPENSE_REMOVED_MESSAGE,
  savings: 'Savings contribution deleted',
};

const FREQUENCY_PER_LABELS: Record<Cadence, string> = {
  weekly: 'per week',
  fortnightly: 'per fortnight',
  monthly: 'per month',
  quarterly: 'per quarter',
  yearly: 'per year',
};

type PlanSection = 'income' | 'expenses' | 'savings';

// The section each ?section= value opens. Bills and allowances are listed
// together, and links written for either of the old sections still land there.
const SECTION_FOR_PARAM: Record<string, PlanSection> = {
  income: 'income',
  expenses: 'expenses',
  fixed: 'expenses',
  variable: 'expenses',
  savings: 'savings',
};

interface CategoryRow {
  id: string;
  category: Category;
  categoryName: string;
  fixedAmount: number;
  variableAmount: number;
  totalAmount: number;
  fixedExpenseRules: ForecastRule[];
}

export type BudgetPeriodValue = BudgetPeriod;

interface PlanTabProps {
  activeScenarioId: string;
  breakdownPeriod: BudgetPeriod;
}

export function PlanTab({ activeScenarioId, breakdownPeriod }: PlanTabProps) {
  const { activeScenario } = useScenarios();
  const { isWhatIfMode, clearAdjustment } = useWhatIf();
  const { getTotalDelta, isViewingDefault, defaultScenarioName, defaultTotals } = useScenarioDiff();
  const showDeltas = !isViewingDefault || isWhatIfMode;
  const comparedToName = defaultScenarioName;
  const { categories, activeCategories, isLoading: categoriesLoading } = useCategories();
  const {
    budgetRules: savedBudgetRules,
    getRulesForCategory,
    isLoading: budgetLoading,
    addBudgetRule,
    updateBudgetRule,
    deleteBudgetRule,
    restoreBudgetRule,
  } = useBudgetRules(activeScenarioId);
  const { budgetRules } = useAdjustedBudgets(activeScenarioId);
  const { savingsGoals, isLoading: savingsLoading } = useSavingsGoals();
  const { allTransactions, isLoading: transactionsLoading } = useTransactions();

  // What each category has cost on average, as a guide when setting allowances
  const spendingAverages = useMemo(
    () => averageMonthlySpendingByCategory(allTransactions, formatISODate(new Date())),
    [allTransactions],
  );

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

  const { rules: adjustedForecastRules } = useAdjustedForecasts(
    activeScenarioId,
    forecastDateRange.startDate,
    forecastDateRange.endDate,
  );

  const isLoading =
    categoriesLoading || budgetLoading || forecastsLoading || savingsLoading || transactionsLoading;

  // Expense dialog state. As with the forecast rule dialog below, the expense
  // is set each time the dialog opens and left alone when it closes.
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Forecast rule dialog state, for income and savings
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ForecastRule | null>(null);
  // The rule and type are set each time the dialog opens and left alone when it
  // closes, so its title and fields do not change while it fades out
  const [ruleDialogType, setRuleDialogType] = useState<RecurringRuleType>('income');

  // Undo-wrapped delete for forecast rules
  const handleDeleteForecastRule = useCallback(
    async (ruleId: string) => {
      const rule = forecastRules.find((r) => r.id === ruleId);
      if (!rule) return;
      await deleteRule(ruleId);
      toast(DELETED_RULE_MESSAGES[rule.type], {
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
      toast(EXPENSE_REMOVED_MESSAGE, {
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

  // The replacement has a new id, so a What If adjustment held under the old
  // one would point at nothing and keep What If mode switched on
  const handleReplaceExpense = useCallback(
    async (expense: Expense, replacement: NewExpense) => {
      await replaceExpenseWithOtherKind(expense, replacement);
      clearAdjustment(expense.rule.id);
    },
    [clearAdjustment],
  );

  const handleRemoveExpense = useCallback(
    (expense: Expense) => {
      if (expense.kind === 'bill') {
        handleDeleteForecastRule(expense.rule.id);
      } else {
        handleDeleteBudgetRule(expense.rule.id);
      }
    },
    [handleDeleteForecastRule, handleDeleteBudgetRule],
  );

  // Collapsible sections state (reset on nav away, opened via ?section= links)
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [savingsOpen, setSavingsOpen] = useState(false);

  // Handle ?section= URL param: expand + scroll to matching section
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionRefs = useRef<Partial<Record<PlanSection, HTMLDivElement | null>>>({});

  useEffect(() => {
    if (isLoading) return; // Wait for content to render before scrolling

    const sectionParam = searchParams.get('section');
    if (!sectionParam) return;

    // Expand the matching section
    const section = SECTION_FOR_PARAM[sectionParam];
    const sectionSetters: Record<PlanSection, (open: boolean) => void> = {
      income: setIncomeOpen,
      expenses: setExpensesOpen,
      savings: setSavingsOpen,
    };
    if (section) {
      sectionSetters[section](true);
      // Clear the param so it doesn't re-trigger
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('section');
          return next;
        },
        { replace: true },
      );
      // Scroll to section after DOM update
      requestAnimationFrame(() => {
        sectionRefs.current[section]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [isLoading, searchParams, setSearchParams, setIncomeOpen, setExpensesOpen, setSavingsOpen]);

  // Expand a section and scroll to it
  const scrollToSection = useCallback((section: PlanSection, setOpen: (open: boolean) => void) => {
    setOpen(true);
    requestAnimationFrame(() => {
      sectionRefs.current[section]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

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

  // Calculate bills per category
  const fixedExpensesPerCategory = useMemo(() => {
    const result: Record<string, { amount: number; rules: ForecastRule[] }> = {};

    for (const rule of adjustedExpenseRules) {
      if (rule.categoryId) {
        if (!result[rule.categoryId]) {
          result[rule.categoryId] = { amount: 0, rules: [] };
        }
        const periodAmount = toPeriodCents(rule.amountCents, rule.cadence, breakdownPeriod);
        const catData = result[rule.categoryId];
        if (catData) {
          catData.amount += periodAmount;
          catData.rules.push(rule);
        }
      }
    }

    return result;
  }, [adjustedExpenseRules, breakdownPeriod]);

  // Build category rows
  const categoryRows: CategoryRow[] = useMemo(() => {
    const rows = categories.map((category) => {
      const fixedData = fixedExpensesPerCategory[category.id];
      const fixedAmount = fixedData?.amount ?? 0;
      const variableAmount = sumAllowancesForPeriod(
        getRulesForCategory(category.id),
        breakdownPeriod,
      );

      return {
        id: category.id,
        category,
        categoryName: category.name,
        fixedAmount,
        variableAmount,
        totalAmount: fixedAmount + variableAmount,
        fixedExpenseRules: fixedData?.rules ?? [],
      };
    });

    return rows.sort((a, b) => {
      if (a.category.isArchived !== b.category.isArchived) {
        return a.category.isArchived ? 1 : -1;
      }
      return a.categoryName.localeCompare(b.categoryName);
    });
  }, [categories, getRulesForCategory, fixedExpensesPerCategory, breakdownPeriod]);

  // Calculate totals
  const totals = useMemo(() => {
    // Income and savings come from each rule's amount and cadence, as bills
    // do. Counting real pay dates over the next twelve months would make a
    // fortnightly pay worth more in the months where 27 of them fit.
    const income = sumForecastRulesForPeriod(adjustedForecastRules, 'income', breakdownPeriod);
    const savings = sumForecastRulesForPeriod(adjustedForecastRules, 'savings', breakdownPeriod);

    const totalFixed = categoryRows
      .filter((r) => !r.category.isArchived)
      .reduce((sum, r) => sum + r.fixedAmount, 0);

    const totalVariable = categoryRows
      .filter((r) => !r.category.isArchived)
      .reduce((sum, r) => sum + r.variableAmount, 0);

    const totalSpending = totalFixed + totalVariable;
    const unallocated = income - totalSpending - savings;

    // Monthly totals for scenario comparison
    const monthlyIncome = sumForecastRulesForPeriod(adjustedForecastRules, 'income', 'monthly');
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
    const monthlySavings = sumForecastRulesForPeriod(adjustedForecastRules, 'savings', 'monthly');
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
  }, [categoryRows, adjustedForecastRules, breakdownPeriod]);

  // Build chart segments
  const budgetBreakdownSegments = useMemo(() => {
    // Always include all segments (even with 0 amount) so Recharts Bar components
    // maintain stable order and new segments don't animate in at the wrong position
    return [
      { id: 'fixed', name: 'Bills', amount: totals.fixed },
      { id: 'savings', name: 'Savings', amount: totals.savings },
      { id: 'variable', name: 'Spending Allowances', amount: totals.variable },
      { id: 'surplus', name: 'Surplus', amount: Math.max(0, totals.unallocated) },
    ];
  }, [totals]);

  // Category color map
  const categoryColorMap = useMemo(() => {
    const map = buildCategoryColorMap(activeCategories.map((c) => c.id));
    map['fixed'] = '#b91c1c';
    map['variable'] = '#ef4444';
    map['savings'] = CHART_COLORS.savings;
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

  const openAddExpenseDialog = useCallback(() => {
    setEditingExpense(null);
    setExpenseDialogOpen(true);
  }, []);

  const openAddRuleDialog = useCallback((type: RecurringRuleType) => {
    setEditingRule(null);
    setRuleDialogType(type);
    setRuleDialogOpen(true);
  }, []);

  // For income and savings. A bill is edited in the expense dialog.
  const openEditRuleDialog = useCallback((rule: ForecastRule) => {
    if (rule.type === 'expense') return;
    setEditingRule(rule);
    setRuleDialogType(rule.type);
    setRuleDialogOpen(true);
  }, []);

  // The section lists allowances with any What If adjustment applied. The
  // dialog edits the saved rule, so an allowance is looked up by id.
  const openEditExpenseDialog = useCallback(
    (expense: Expense) => {
      if (expense.kind === 'bill') {
        setEditingExpense(expense);
        setExpenseDialogOpen(true);
        return;
      }
      const savedRule = savedBudgetRules.find((rule) => rule.id === expense.rule.id);
      if (savedRule) {
        setEditingExpense({ kind: 'allowance', rule: savedRule });
        setExpenseDialogOpen(true);
      }
    },
    [savedBudgetRules],
  );

  if (isLoading) {
    return null;
  }

  // Compute deltas directly (bypass getTotalDelta which short-circuits when isViewingDefault,
  // blocking what-if mode detection)
  const incomeDelta = showDeltas ? totals.monthlyIncome - defaultTotals.income : 0;
  const fixedDelta = showDeltas ? totals.monthlyFixed - defaultTotals.fixedExpenses : 0;
  const budgetDelta = showDeltas ? totals.monthlyVariable - defaultTotals.budgetedExpenses : 0;
  const savingsDelta = showDeltas ? totals.monthlySavings - defaultTotals.savings : 0;
  const surplusDelta = showDeltas ? totals.monthlySurplus - defaultTotals.surplus : 0;

  // Cards only quote a share of income when both figures are present.
  const shareOfIncome = (amount: number): string | undefined =>
    totals.income > 0 && amount > 0
      ? `${Math.round((amount / totals.income) * 100)}% of income`
      : undefined;

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
      {/* Budget Status Hero */}
      {(totals.income > 0 || isOvercommitted) && (
        <div className="mb-4">
          <BudgetStatusHero
            scenarioName={activeScenario?.name ?? 'Default'}
            status={
              isOvercommitted
                ? 'shortfall'
                : isFullyAllocated
                  ? 'balanced'
                  : hasAvailable
                    ? 'surplus'
                    : null
            }
            amountCents={totals.unallocated}
            differsFromPlan={surplusDelta !== 0}
            periodLabel={
              isOvercommitted && totals.income === 0
                ? 'Add income to cover your planned expenses and savings'
                : FREQUENCY_PER_LABELS[breakdownPeriod]
            }
            delta={getTotalDelta('surplus', totals.monthlySurplus)}
            showDelta={showDeltas}
            comparedToName={comparedToName}
          />
        </div>
      )}
      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BudgetSummaryCard
          label="Income"
          icon={BanknoteArrowUp}
          tone="income"
          amountCents={totals.income > 0 ? totals.income : null}
          differsFromPlan={incomeDelta !== 0}
          subtitle={
            totals.income > 0
              ? `${incomeRules.length} source${incomeRules.length !== 1 ? 's' : ''}`
              : undefined
          }
          delta={getTotalDelta('income', totals.monthlyIncome)}
          showDelta={showDeltas}
          comparedToName={comparedToName}
          onClick={() => scrollToSection('income', setIncomeOpen)}
        />

        <BudgetSummaryCard
          label="Bills"
          icon={BanknoteArrowDown}
          tone="expense"
          amountCents={totals.fixed > 0 ? totals.fixed : null}
          differsFromPlan={fixedDelta !== 0}
          subtitle={shareOfIncome(totals.fixed)}
          delta={getTotalDelta('fixed', totals.monthlyFixed)}
          showDelta={showDeltas}
          comparedToName={comparedToName}
          onClick={() => scrollToSection('expenses', setExpensesOpen)}
        />

        <BudgetSummaryCard
          label="Spending Allowances"
          icon={BanknoteArrowDown}
          tone="expense"
          amountCents={totals.variable > 0 ? totals.variable : null}
          differsFromPlan={budgetDelta !== 0}
          subtitle={shareOfIncome(totals.variable)}
          delta={getTotalDelta('budget', totals.monthlyVariable)}
          showDelta={showDeltas}
          comparedToName={comparedToName}
          onClick={() => scrollToSection('expenses', setExpensesOpen)}
        />

        <BudgetSummaryCard
          label="Savings"
          icon={PiggyBank}
          tone="savings"
          amountCents={totals.savings}
          differsFromPlan={savingsDelta !== 0}
          subtitle={shareOfIncome(totals.savings)}
          delta={getTotalDelta('savings', totals.monthlySavings)}
          showDelta={showDeltas}
          comparedToName={comparedToName}
          onClick={() => scrollToSection('savings', setSavingsOpen)}
        />
      </div>

      {/* Breakdown Chart */}
      {budgetBreakdownSegments.some((s) => s.amount > 0) &&
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
                          className={
                            incomeDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : 'hidden'
                          }
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
      <div
        id="section-income"
        ref={(el) => {
          sectionRefs.current['income'] = el;
        }}
      >
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
      </div>

      {/* Expenses Section: bills and allowances together */}
      <div
        id="section-expenses"
        ref={(el) => {
          sectionRefs.current['expenses'] = el;
        }}
      >
        <ExpensesSliderSection
          billRules={expenseRules}
          allowanceRules={budgetRules}
          categories={categories}
          isOpen={expensesOpen}
          onOpenChange={setExpensesOpen}
          onAddClick={openAddExpenseDialog}
          onEditExpense={openEditExpenseDialog}
          onDeleteExpense={handleRemoveExpense}
          spendingAverages={spendingAverages}
          period={breakdownPeriod}
          periodLabel={FREQUENCY_PER_LABELS[breakdownPeriod]}
          periodTotal={totals.totalSpending}
          monthlyDelta={
            showDeltas
              ? getTotalDelta('fixed', totals.monthlyFixed) +
                getTotalDelta('budget', totals.monthlyVariable)
              : undefined
          }
        />
      </div>

      {/* Savings Contributions Section */}
      <div
        id="section-savings"
        ref={(el) => {
          sectionRefs.current['savings'] = el;
        }}
      >
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
      </div>

      {/* Expense Dialog, for adding and editing bills and allowances */}
      <ExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        scenarioId={activeScenarioId}
        expense={editingExpense}
        unallocatedAmount={totals.unallocated}
        hasIncome={totals.income > 0}
        period={breakdownPeriod}
        existingAllowances={savedBudgetRules}
        existingBills={expenseRules}
        spendingAverages={spendingAverages}
        addBudgetRule={addBudgetRule}
        updateBudgetRule={updateBudgetRule}
        addRule={addRule}
        updateRule={updateRule}
        replaceExpense={handleReplaceExpense}
        onRemove={handleRemoveExpense}
      />

      {/* Forecast Rule Dialog, for income and savings */}
      <ForecastRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        scenarioId={activeScenarioId}
        rule={editingRule}
        addRule={addRule}
        updateRule={updateRule}
        type={ruleDialogType}
        existingRules={forecastRules}
      />
    </div>
  );
}
