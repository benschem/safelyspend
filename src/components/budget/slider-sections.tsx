import { useMemo } from 'react';
import { Link } from 'react-router';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  BanknoteArrowUp,
  BanknoteArrowDown,
  PiggyBank,
  Tag,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, formatCents, type CadenceType } from '@/lib/utils';
import { BudgetSlider, getSliderRange, getIncomeSliderRange } from './budget-slider';
import { useWhatIf } from '@/contexts/what-if-context';
import { useScenarioDiff } from '@/hooks/use-scenario-diff';
import { allowanceLabel, sumAllowancesForPeriod } from '@/lib/allowances';
import {
  describeBillDue,
  groupExpensesByCategory,
  UNCATEGORISED_LABEL,
  type Expense,
} from '@/lib/expenses';
import { sumForecastRulesForPeriod } from '@/lib/plan-amounts';
import { describeAverageSpending, type SpendingAverages } from '@/lib/spending-averages';
import type { ForecastRule, BudgetRule, Cadence, Category, SavingsGoal } from '@/lib/types';

function SliderActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <span className="flex gap-0.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onEdit}
              className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Edit"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onDelete}
              className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-500"
              aria-label="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}

interface IncomeSectionProps {
  incomeRules: ForecastRule[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddClick: () => void;
  onEditRule: (rule: ForecastRule) => void;
  onDeleteRule: (ruleId: string) => void;
  periodLabel: string;
  periodTotal: number;
  /** Monthly delta from default scenario (current - default) */
  monthlyDelta?: number | undefined;
}

export function IncomeSliderSection({
  incomeRules,
  isOpen,
  onOpenChange,
  onAddClick,
  onEditRule,
  onDeleteRule,
  periodLabel,
  periodTotal,
  monthlyDelta,
}: IncomeSectionProps) {
  const { adjustments, baselineValues, setIncomeAdjustment } = useWhatIf();
  const { isIncomeDifferent, defaultIncomeByDescription, defaultScenarioName } = useScenarioDiff();

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="mb-4">
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between bg-card p-4">
          <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-2">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <BanknoteArrowUp className="h-4 w-4 text-green-500" />
            <span className="font-medium">Income</span>
            <span className="text-sm text-muted-foreground">
              <span
                className={cn(
                  monthlyDelta !== undefined &&
                    monthlyDelta !== 0 &&
                    'text-violet-600 dark:text-violet-400',
                )}
              >
                {formatCents(periodTotal)}
              </span>{' '}
              {periodLabel}
              <span
                className={`ml-1 inline-block min-w-[4.5rem] ${monthlyDelta !== undefined && monthlyDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : 'invisible'}`}
              >
                ({monthlyDelta !== undefined && monthlyDelta > 0 ? '+' : ''}
                {formatCents(monthlyDelta ?? 0)})
              </span>
            </span>
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Add income"
            onClick={(e) => {
              e.stopPropagation();
              onAddClick();
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <CollapsibleContent>
          <div className="space-y-3 border-t p-4">
            {incomeRules.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No income sources yet.{' '}
                <button
                  onClick={onAddClick}
                  className="cursor-pointer text-primary hover:underline"
                >
                  Add one
                </button>
              </p>
            ) : (
              incomeRules.map((rule) => {
                const baseline = baselineValues.incomeAdjustments[rule.id] ?? rule.amountCents;
                const value = adjustments.incomeAdjustments[rule.id] ?? baseline;
                const range = getIncomeSliderRange(baseline);
                const differsFromDefault = isIncomeDifferent(rule.description, baseline);
                const defaultValue = defaultIncomeByDescription[rule.description];

                return (
                  <BudgetSlider
                    key={rule.id}
                    label={rule.description}
                    value={value}
                    baseline={baseline}
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    onChange={(cents) => setIncomeAdjustment(rule.id, cents)}
                    cadence={rule.cadence as CadenceType}
                    variant="income"
                    differsFromDefault={differsFromDefault}
                    defaultValue={defaultValue}
                    defaultScenarioName={defaultScenarioName}
                    actions={
                      <SliderActions
                        onEdit={() => onEditRule(rule)}
                        onDelete={() => onDeleteRule(rule.id)}
                      />
                    }
                  />
                );
              })
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface ExpensesSectionProps {
  /** Expenses with a due date */
  billRules: ForecastRule[];
  /** Expenses without one */
  allowanceRules: BudgetRule[];
  categories: Category[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddClick: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
  /** The period the totals are quoted over, which periodLabel names */
  period: Cadence;
  periodLabel: string;
  periodTotal: number;
  /** Monthly delta from default scenario (current - default) */
  monthlyDelta?: number | undefined;
  /** What each category has cost on average, shown under its heading */
  spendingAverages: SpendingAverages | null;
}

export function ExpensesSliderSection({
  billRules,
  allowanceRules,
  categories,
  spendingAverages,
  isOpen,
  onOpenChange,
  onAddClick,
  onEditExpense,
  onDeleteExpense,
  period,
  periodLabel,
  periodTotal,
  monthlyDelta,
}: ExpensesSectionProps) {
  const { adjustments, baselineValues, setFixedExpenseAdjustment, setBudgetAdjustment } =
    useWhatIf();
  const {
    isExpenseDifferent,
    defaultExpenseByDescription,
    isBudgetDifferent,
    getDefaultAllowanceAmount,
    defaultScenarioName,
  } = useScenarioDiff();

  const expenseGroups = useMemo(
    () => groupExpensesByCategory(billRules, allowanceRules, categories),
    [billRules, allowanceRules, categories],
  );

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="mb-4">
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between bg-card p-4">
          <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-2">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <BanknoteArrowDown className="h-4 w-4 text-rose-500" />
            <span className="font-medium">Expenses</span>
            <span className="text-sm text-muted-foreground">
              <span
                className={cn(
                  monthlyDelta !== undefined &&
                    monthlyDelta !== 0 &&
                    'text-violet-600 dark:text-violet-400',
                )}
              >
                {formatCents(periodTotal)}
              </span>{' '}
              {periodLabel}
              <span
                className={`ml-1 inline-block min-w-[4.5rem] ${monthlyDelta !== undefined && monthlyDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : 'invisible'}`}
              >
                ({monthlyDelta !== undefined && monthlyDelta > 0 ? '+' : ''}
                {formatCents(monthlyDelta ?? 0)})
              </span>
            </span>
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Add expense"
            onClick={(e) => {
              e.stopPropagation();
              onAddClick();
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <CollapsibleContent>
          <div className="space-y-4 border-t p-4">
            {expenseGroups.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No expenses yet.{' '}
                <button
                  onClick={onAddClick}
                  className="cursor-pointer text-primary hover:underline"
                >
                  Add one
                </button>
              </p>
            ) : (
              expenseGroups.map((group) => {
                const averageSpendingHint = group.categoryId
                  ? describeAverageSpending(spendingAverages, group.categoryId, period)
                  : null;
                // The allowances arrive with any What If adjustment applied.
                // The heading quotes the saved amounts, as the section's total
                // above it does, so the headings add up to that total.
                const savedBills = group.bills.map((rule) => ({
                  ...rule,
                  amountCents: baselineValues.fixedExpenseAdjustments[rule.id] ?? rule.amountCents,
                }));
                const savedAllowances = group.allowances.map((rule) => ({
                  ...rule,
                  amountCents: baselineValues.budgetAdjustments[rule.id] ?? rule.amountCents,
                }));
                const groupTotal =
                  sumForecastRulesForPeriod(savedBills, 'expense', period) +
                  sumAllowancesForPeriod(savedAllowances, period);

                return (
                  <div key={group.categoryId ?? UNCATEGORISED_LABEL}>
                    <div className="mb-2">
                      <div className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5" />
                          {group.categoryId ? (
                            <Link
                              to={`/categories/${group.categoryId}?from=budget`}
                              className="hover:underline"
                            >
                              {group.name}
                            </Link>
                          ) : (
                            group.name
                          )}
                        </span>
                        <span className="tabular-nums">
                          {formatCents(groupTotal)} {periodLabel}
                        </span>
                      </div>
                      {averageSpendingHint && (
                        <p className="mt-1 text-xs text-muted-foreground">{averageSpendingHint}</p>
                      )}
                    </div>
                    <div className="space-y-3">
                      {group.bills.map((rule) => {
                        const baseline =
                          baselineValues.fixedExpenseAdjustments[rule.id] ?? rule.amountCents;
                        const value = adjustments.fixedExpenseAdjustments[rule.id] ?? baseline;
                        const range = getSliderRange(baseline);
                        const differsFromDefault = isExpenseDifferent(rule.description, baseline);
                        const defaultValue = defaultExpenseByDescription[rule.description];

                        return (
                          <BudgetSlider
                            key={rule.id}
                            label={rule.description}
                            hint={describeBillDue(rule)}
                            value={value}
                            baseline={baseline}
                            min={range.min}
                            max={range.max}
                            step={range.step}
                            onChange={(cents) => setFixedExpenseAdjustment(rule.id, cents)}
                            cadence={rule.cadence as CadenceType}
                            variant="expense"
                            differsFromDefault={differsFromDefault}
                            defaultValue={defaultValue}
                            defaultScenarioName={defaultScenarioName}
                            actions={
                              <SliderActions
                                onEdit={() => onEditExpense({ kind: 'bill', rule })}
                                onDelete={() => onDeleteExpense({ kind: 'bill', rule })}
                              />
                            }
                          />
                        );
                      })}
                      {group.allowances.map((rule) => {
                        const baseline =
                          baselineValues.budgetAdjustments[rule.id] ?? rule.amountCents;
                        const value = adjustments.budgetAdjustments[rule.id] ?? baseline;
                        const range = getSliderRange(baseline);
                        const differsFromDefault = isBudgetDifferent(rule, baseline);
                        const defaultValue = getDefaultAllowanceAmount(rule, baseline);

                        return (
                          <BudgetSlider
                            key={rule.id}
                            label={allowanceLabel(rule)}
                            value={value}
                            baseline={baseline}
                            min={range.min}
                            max={range.max}
                            step={range.step}
                            onChange={(cents) => setBudgetAdjustment(rule.id, cents)}
                            cadence={rule.cadence as CadenceType}
                            variant="expense"
                            differsFromDefault={differsFromDefault}
                            defaultValue={defaultValue}
                            defaultScenarioName={defaultScenarioName}
                            actions={
                              <SliderActions
                                onEdit={() => onEditExpense({ kind: 'allowance', rule })}
                                onDelete={() => onDeleteExpense({ kind: 'allowance', rule })}
                              />
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface SavingsSectionProps {
  savingsRules: ForecastRule[];
  savingsGoals: SavingsGoal[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddClick: () => void;
  onEditRule: (rule: ForecastRule) => void;
  onDeleteRule: (ruleId: string) => void;
  periodLabel: string;
  periodTotal: number;
  /** Monthly delta from default scenario (current - default) */
  monthlyDelta?: number | undefined;
}

export function SavingsSliderSection({
  savingsRules,
  savingsGoals,
  isOpen,
  onOpenChange,
  onAddClick,
  onEditRule,
  onDeleteRule,
  periodLabel,
  periodTotal,
  monthlyDelta,
}: SavingsSectionProps) {
  const { adjustments, baselineValues, setSavingsAdjustment } = useWhatIf();
  const { isSavingsDifferent, defaultSavingsByDescription, defaultScenarioName } =
    useScenarioDiff();

  const getGoalName = (id: string | null) =>
    id ? (savingsGoals.find((g) => g.id === id)?.name ?? 'Unknown') : 'Savings';

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="mb-4">
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between bg-card p-4">
          <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-2">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <PiggyBank className="h-4 w-4 text-blue-500" />
            <span className="font-medium">Savings</span>
            <span className="text-sm text-muted-foreground">
              <span
                className={cn(
                  monthlyDelta !== undefined &&
                    monthlyDelta !== 0 &&
                    'text-violet-600 dark:text-violet-400',
                )}
              >
                {formatCents(periodTotal)}
              </span>{' '}
              {periodLabel}
              <span
                className={`ml-1 inline-block min-w-[4.5rem] ${monthlyDelta !== undefined && monthlyDelta !== 0 ? 'text-violet-600 dark:text-violet-400' : 'invisible'}`}
              >
                ({monthlyDelta !== undefined && monthlyDelta > 0 ? '+' : ''}
                {formatCents(monthlyDelta ?? 0)})
              </span>
            </span>
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Add savings contribution"
            onClick={(e) => {
              e.stopPropagation();
              onAddClick();
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <CollapsibleContent>
          <div className="space-y-3 border-t p-4">
            {savingsRules.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No savings contributions yet.{' '}
                <button
                  onClick={onAddClick}
                  className="cursor-pointer text-primary hover:underline"
                >
                  Add one
                </button>
              </p>
            ) : (
              savingsRules.map((rule) => {
                const baseline = baselineValues.savingsAdjustments[rule.id] ?? rule.amountCents;
                const value = adjustments.savingsAdjustments[rule.id] ?? baseline;
                const range = getSliderRange(baseline);
                const goalName = getGoalName(rule.savingsGoalId);
                const differsFromDefault = isSavingsDifferent(rule.description, baseline);
                const defaultValue = defaultSavingsByDescription[rule.description];

                return (
                  <BudgetSlider
                    key={rule.id}
                    label={goalName}
                    labelHref="/savings"
                    value={value}
                    baseline={baseline}
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    onChange={(cents) => setSavingsAdjustment(rule.id, cents)}
                    cadence={rule.cadence as CadenceType}
                    variant="savings"
                    differsFromDefault={differsFromDefault}
                    defaultValue={defaultValue}
                    defaultScenarioName={defaultScenarioName}
                    actions={
                      <SliderActions
                        onEdit={() => onEditRule(rule)}
                        onDelete={() => onDeleteRule(rule.id)}
                      />
                    }
                  />
                );
              })
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
