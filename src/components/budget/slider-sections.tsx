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
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCents, type CadenceType } from '@/lib/utils';
import { BudgetSlider, getSliderRange, getIncomeSliderRange } from './budget-slider';
import { useWhatIf } from '@/contexts/what-if-context';
import { useScenarioDiff } from '@/hooks/use-scenario-diff';
import type { ForecastRule, BudgetRule, Category, SavingsGoal } from '@/lib/types';

function SliderActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <span className="flex gap-0.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onEdit}
              className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
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
  const { isIncomeDifferent, defaultIncomeByDescription } = useScenarioDiff();

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="mb-4">
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between bg-card p-4">
          <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-2">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <BanknoteArrowUp className="h-4 w-4 text-green-500" />
            <span className="font-medium">Income</span>
            <span className="text-sm text-muted-foreground">
              {formatCents(periodTotal)} {periodLabel}
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

interface FixedExpenseSectionProps {
  expenseRules: ForecastRule[];
  categories: Category[];
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

export function FixedExpenseSliderSection({
  expenseRules,
  categories,
  isOpen,
  onOpenChange,
  onAddClick,
  onEditRule,
  onDeleteRule,
  periodLabel,
  periodTotal,
  monthlyDelta,
}: FixedExpenseSectionProps) {
  const { adjustments, baselineValues, setFixedExpenseAdjustment } = useWhatIf();
  const { isExpenseDifferent, defaultExpenseByDescription } = useScenarioDiff();

  // Group rules by category
  const groupedRules = useMemo(() => {
    const groups = new Map<string, { name: string; categoryId: string | null; rules: ForecastRule[] }>();
    for (const rule of expenseRules) {
      const key = rule.categoryId ?? '__uncategorized__';
      if (!groups.has(key)) {
        const category = rule.categoryId ? categories.find((c) => c.id === rule.categoryId) : null;
        groups.set(key, {
          name: category?.name ?? 'Uncategorized',
          categoryId: rule.categoryId,
          rules: [],
        });
      }
      groups.get(key)!.rules.push(rule);
    }
    // Sort groups alphabetically by name
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [expenseRules, categories]);

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="mb-4">
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between bg-card p-4">
          <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-2">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <BanknoteArrowDown className="h-4 w-4 text-rose-500" />
            <span className="font-medium">Fixed Expenses</span>
            <span className="text-sm text-muted-foreground">
              {formatCents(periodTotal)} {periodLabel}
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
            {expenseRules.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No fixed expenses yet.{' '}
                <button
                  onClick={onAddClick}
                  className="cursor-pointer text-primary hover:underline"
                >
                  Add one
                </button>
              </p>
            ) : (
              groupedRules.map((group) => (
                <div key={group.categoryId ?? '__uncategorized__'}>
                  <div className="mb-2 text-sm font-medium text-muted-foreground">
                    {group.categoryId ? (
                      <Link to={`/categories/${group.categoryId}`} className="hover:underline">
                        {group.name}
                      </Link>
                    ) : (
                      group.name
                    )}
                  </div>
                  <div className="space-y-3">
                    {group.rules.map((rule) => {
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
                          actions={
                            <SliderActions
                              onEdit={() => onEditRule(rule)}
                              onDelete={() => onDeleteRule(rule.id)}
                            />
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface BudgetedSpendingSectionProps {
  budgetRules: BudgetRule[];
  categories: Category[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddClick: () => void;
  onEditBudget: (rule: BudgetRule) => void;
  onDeleteBudget: (ruleId: string) => void;
  periodLabel: string;
  periodTotal: number;
  /** Monthly delta from default scenario (current - default) */
  monthlyDelta?: number | undefined;
}

export function BudgetedSpendingSliderSection({
  budgetRules,
  categories,
  isOpen,
  onOpenChange,
  onAddClick,
  onEditBudget,
  onDeleteBudget,
  periodLabel,
  periodTotal,
  monthlyDelta,
}: BudgetedSpendingSectionProps) {
  const { adjustments, baselineValues, setBudgetAdjustment } = useWhatIf();
  const { isBudgetDifferent, defaultBudgetByCategory } = useScenarioDiff();

  // Create a map of categoryId to category for quick lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  // Only show rules for active (non-archived) categories
  const activeRules = useMemo(() => {
    return budgetRules.filter((rule) => {
      const category = categoryMap.get(rule.categoryId);
      return category && !category.isArchived;
    });
  }, [budgetRules, categoryMap]);

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="mb-4">
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between bg-card p-4">
          <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-2">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <BanknoteArrowDown className="h-4 w-4 text-rose-500" />
            <span className="font-medium">Budgeted Spending</span>
            <span className="text-sm text-muted-foreground">
              {formatCents(periodTotal)} {periodLabel}
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
            {activeRules.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No budgets set yet.{' '}
                <button
                  onClick={onAddClick}
                  className="cursor-pointer text-primary hover:underline"
                >
                  Add one
                </button>
              </p>
            ) : (
              activeRules.map((rule) => {
                const category = categoryMap.get(rule.categoryId);
                const categoryName = category?.name ?? 'Unknown';
                const baseline =
                  baselineValues.budgetAdjustments[rule.categoryId] ?? rule.amountCents;
                const value = adjustments.budgetAdjustments[rule.categoryId] ?? baseline;
                const range = getSliderRange(baseline);
                const differsFromDefault = isBudgetDifferent(rule.categoryId, baseline);
                const defaultValue = defaultBudgetByCategory[rule.categoryId];

                return (
                  <BudgetSlider
                    key={rule.id}
                    label={categoryName}
                    labelHref={`/categories/${rule.categoryId}`}
                    value={value}
                    baseline={baseline}
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    onChange={(cents) => setBudgetAdjustment(rule.categoryId, cents)}
                    cadence={rule.cadence as CadenceType}
                    variant="expense"
                    differsFromDefault={differsFromDefault}
                    defaultValue={defaultValue}
                    actions={
                      <SliderActions
                        onEdit={() => onEditBudget(rule)}
                        onDelete={() => onDeleteBudget(rule.id)}
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
  const { isSavingsDifferent, defaultSavingsByDescription } = useScenarioDiff();

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
              {formatCents(periodTotal)} {periodLabel}
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
