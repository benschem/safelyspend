import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  PiggyBank,
  BanknoteArrowUp,
  BanknoteArrowDown,
  ChartPie,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatISODate } from '@/lib/dates';
import { cn, formatCents } from '@/lib/utils';
import { averageMonthlySpendingByCategory } from '@/lib/spending-averages';
import { CHART_COLORS } from '@/lib/chart-colors';
import { sumForecastRulesForPeriod, toPeriodCents } from '@/lib/plan-amounts';
import { sumAllowancesForPeriod } from '@/lib/allowances';
import { useScenarios } from '@/hooks/use-scenarios';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useForecasts } from '@/hooks/use-forecasts';
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
import { IncomeSection, ExpensesSection, SavingsSection } from '@/components/budget/plan-sections';
import type { Expense } from '@/lib/expenses';
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

interface PlanTabConfig {
  section: PlanSection;
  label: string;
  icon: LucideIcon;
  iconColour: string;
  totalCents: number;
  addLabel: string;
  onAddClick: () => void;
}

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
  const { categories, activeCategories, isLoading: categoriesLoading } = useCategories();
  const {
    budgetRules,
    getRulesForCategory,
    isLoading: budgetLoading,
    addBudgetRule,
    updateBudgetRule,
    deleteBudgetRule,
    restoreBudgetRule,
  } = useBudgetRules(activeScenarioId);
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
    return { startDate: formatISODate(startDay), endDate: formatISODate(endDay) };
  }, []);

  const {
    rules: forecastRules,
    isLoading: forecastsLoading,
    addRule,
    updateRule,
    deleteRule,
    restoreRule,
  } = useForecasts(activeScenarioId, forecastDateRange.startDate, forecastDateRange.endDate);

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

  // The tab showing (reset on nav away, chosen via ?section= links)
  const [selectedSection, setSelectedSection] = useState<PlanSection>('expenses');
  const planTabsRef = useRef<HTMLDivElement | null>(null);

  // Show a section's tab and scroll to the tabs
  const showSection = useCallback((section: PlanSection) => {
    setSelectedSection(section);
    requestAnimationFrame(() => {
      planTabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // Handle ?section= URL param: show the matching tab and scroll to it
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (isLoading) return; // Wait for content to render before scrolling

    const sectionParam = searchParams.get('section');
    if (!sectionParam) return;

    const section = SECTION_FOR_PARAM[sectionParam];
    if (section) {
      // Clear the param so it doesn't re-trigger
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('section');
          return next;
        },
        { replace: true },
      );
      showSection(section);
    }
  }, [isLoading, searchParams, setSearchParams, showSection]);

  // Chart visibility state
  const [hiddenSegments, setHiddenSegments] = useState<Set<string>>(new Set());

  // Filter forecast rules by type (base rules for the plan sections)
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

  // Calculate bills per category
  const fixedExpensesPerCategory = useMemo(() => {
    const result: Record<string, { amount: number; rules: ForecastRule[] }> = {};

    for (const rule of expenseRules) {
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
  }, [expenseRules, breakdownPeriod]);

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
    const income = sumForecastRulesForPeriod(forecastRules, 'income', breakdownPeriod);
    const savings = sumForecastRulesForPeriod(forecastRules, 'savings', breakdownPeriod);

    const totalFixed = categoryRows
      .filter((r) => !r.category.isArchived)
      .reduce((sum, r) => sum + r.fixedAmount, 0);

    const totalVariable = categoryRows
      .filter((r) => !r.category.isArchived)
      .reduce((sum, r) => sum + r.variableAmount, 0);

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
  }, [categoryRows, forecastRules, breakdownPeriod]);

  // Build chart segments
  const budgetBreakdownSegments = useMemo(() => {
    // Always include all segments (even with 0 amount) so Recharts Bar components
    // maintain stable order and new segments don't animate in at the wrong position
    return [
      { id: 'fixed', name: 'Bills', amount: totals.fixed },
      { id: 'variable', name: 'Spending Allowances', amount: totals.variable },
      { id: 'savings', name: 'Savings', amount: totals.savings },
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

  const openEditExpenseDialog = useCallback((expense: Expense) => {
    setEditingExpense(expense);
    setExpenseDialogOpen(true);
  }, []);

  if (isLoading) {
    return null;
  }

  // One tab per section of the plan, each with its total and what its Add button opens
  const incomePlanTab: PlanTabConfig = {
    section: 'income',
    label: 'Income',
    icon: BanknoteArrowUp,
    iconColour: 'text-green-500',
    totalCents: totals.income,
    addLabel: 'Add income',
    onAddClick: () => openAddRuleDialog('income'),
  };
  const planTabs: PlanTabConfig[] = [
    incomePlanTab,
    {
      section: 'expenses',
      label: 'Expenses',
      icon: BanknoteArrowDown,
      iconColour: 'text-rose-500',
      totalCents: totals.totalSpending,
      addLabel: 'Add expense',
      onAddClick: openAddExpenseDialog,
    },
    {
      section: 'savings',
      label: 'Savings',
      icon: PiggyBank,
      iconColour: 'text-blue-500',
      totalCents: totals.savings,
      addLabel: 'Add savings contribution',
      onAddClick: () => openAddRuleDialog('savings'),
    },
  ];
  const selectedPlanTab =
    planTabs.find((planTab) => planTab.section === selectedSection) ?? incomePlanTab;

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
            periodLabel={
              isOvercommitted && totals.income === 0
                ? 'Add income to cover your planned expenses and savings'
                : FREQUENCY_PER_LABELS[breakdownPeriod]
            }
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
          subtitle={
            totals.income > 0
              ? `${incomeRules.length} source${incomeRules.length !== 1 ? 's' : ''}`
              : undefined
          }
          onClick={() => showSection('income')}
        />

        <BudgetSummaryCard
          label="Bills"
          icon={BanknoteArrowDown}
          tone="expense"
          amountCents={totals.fixed > 0 ? totals.fixed : null}
          subtitle={shareOfIncome(totals.fixed)}
          onClick={() => showSection('expenses')}
        />

        <BudgetSummaryCard
          label="Spending Allowances"
          icon={BanknoteArrowDown}
          tone="expense"
          amountCents={totals.variable > 0 ? totals.variable : null}
          subtitle={shareOfIncome(totals.variable)}
          onClick={() => showSection('expenses')}
        />

        <BudgetSummaryCard
          label="Savings"
          icon={PiggyBank}
          tone="savings"
          amountCents={totals.savings}
          subtitle={shareOfIncome(totals.savings)}
          onClick={() => showSection('savings')}
        />
      </div>

      {/* Breakdown Chart */}
      {budgetBreakdownSegments.some((s) => s.amount > 0) &&
        (() => {
          const surplusHidden = hiddenSegments.has('surplus');
          const budgetTotal = totals.fixed + totals.savings + totals.variable;
          return (
            <div className="mb-8 rounded-xl border bg-card p-5">
              <div className="mb-2 flex items-center gap-2">
                <ChartPie className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">
                  {surplusHidden ? 'Budget Breakdown' : 'Income Breakdown'}
                </h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                {surplusHidden
                  ? `How your ${formatCents(budgetTotal)} budget is allocated`
                  : `How your ${formatCents(totals.income)} income is allocated`}
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

      {/* Income, expenses and savings, one tab each */}
      <Tabs
        ref={planTabsRef}
        value={selectedSection}
        onValueChange={(section) => setSelectedSection(section as PlanSection)}
        className="mb-4 scroll-mt-4"
      >
        <div className="mb-4 flex items-end justify-between gap-3 border-b">
          <TabsList className="-mb-px overflow-x-auto border-b-0">
            {planTabs.map((planTab) => (
              <TabsTrigger key={planTab.section} value={planTab.section} className="gap-2">
                <planTab.icon className={cn('h-4 w-4', planTab.iconColour)} />
                {planTab.label}
                <span className="font-normal text-muted-foreground tabular-nums">
                  {formatCents(planTab.totalCents)}
                  <span className="hidden sm:inline"> {FREQUENCY_PER_LABELS[breakdownPeriod]}</span>
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          <Button
            variant="ghost"
            size="sm"
            className="mb-1 shrink-0"
            onClick={selectedPlanTab.onAddClick}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">{selectedPlanTab.addLabel}</span>
          </Button>
        </div>

        <TabsContent value="income">
          <IncomeSection
            incomeRules={incomeRules}
            onAddClick={() => openAddRuleDialog('income')}
            onEditRule={openEditRuleDialog}
            onDeleteRule={handleDeleteForecastRule}
          />
        </TabsContent>

        {/* Bills and allowances together */}
        <TabsContent value="expenses">
          <ExpensesSection
            billRules={expenseRules}
            allowanceRules={budgetRules}
            categories={categories}
            onAddClick={openAddExpenseDialog}
            onEditExpense={openEditExpenseDialog}
            onDeleteExpense={handleRemoveExpense}
            spendingAverages={spendingAverages}
            period={breakdownPeriod}
            periodLabel={FREQUENCY_PER_LABELS[breakdownPeriod]}
          />
        </TabsContent>

        <TabsContent value="savings">
          <SavingsSection
            savingsRules={savingsRules}
            savingsGoals={savingsGoals}
            onAddClick={() => openAddRuleDialog('savings')}
            onEditRule={openEditRuleDialog}
            onDeleteRule={handleDeleteForecastRule}
          />
        </TabsContent>
      </Tabs>

      {/* Expense Dialog, for adding and editing bills and allowances */}
      <ExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        scenarioId={activeScenarioId}
        expense={editingExpense}
        unallocatedAmount={totals.unallocated}
        hasIncome={totals.income > 0}
        period={breakdownPeriod}
        existingAllowances={budgetRules}
        existingBills={expenseRules}
        spendingAverages={spendingAverages}
        addBudgetRule={addBudgetRule}
        updateBudgetRule={updateBudgetRule}
        addRule={addRule}
        updateRule={updateRule}
        replaceExpense={replaceExpenseWithOtherKind}
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
