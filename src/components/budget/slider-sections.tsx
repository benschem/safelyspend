import { useMemo } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  BanknoteArrowUp,
  BanknoteArrowDown,
  PiggyBank,
} from 'lucide-react';
import { formatCents, type CadenceType } from '@/lib/utils';
import { BudgetSlider, getSliderRange, getIncomeSliderRange } from './budget-slider';
import { useWhatIf } from '@/contexts/what-if-context';
import type { ForecastRule, BudgetRule, Category, SavingsGoal } from '@/lib/types';

interface IncomeSectionProps {
  incomeRules: ForecastRule[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddClick: () => void;
  periodLabel: string;
  periodTotal: number;
}

export function IncomeSliderSection({
  incomeRules,
  isOpen,
  onOpenChange,
  onAddClick,
  periodLabel,
  periodTotal,
}: IncomeSectionProps) {
  const { adjustments, baselineValues, setIncomeAdjustment } = useWhatIf();

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
            </span>
          </CollapsibleTrigger>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onAddClick(); }}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <CollapsibleContent>
          <div className="space-y-3 border-t p-4">
            {incomeRules.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No income sources yet.{' '}
                <button onClick={onAddClick} className="cursor-pointer text-primary hover:underline">
                  Add one
                </button>
              </p>
            ) : (
              incomeRules.map((rule) => {
                const baseline = baselineValues.incomeAdjustments[rule.id] ?? rule.amountCents;
                const value = adjustments.incomeAdjustments[rule.id] ?? baseline;
                const range = getIncomeSliderRange(baseline);

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
  periodLabel: string;
  periodTotal: number;
}

export function FixedExpenseSliderSection({
  expenseRules,
  categories,
  isOpen,
  onOpenChange,
  onAddClick,
  periodLabel,
  periodTotal,
}: FixedExpenseSectionProps) {
  const { adjustments, baselineValues, setFixedExpenseAdjustment } = useWhatIf();

  const getCategoryName = (id: string | null) =>
    id ? categories.find((c) => c.id === id)?.name ?? 'Unknown' : '—';

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
            </span>
          </CollapsibleTrigger>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onAddClick(); }}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <CollapsibleContent>
          <div className="space-y-3 border-t p-4">
            {expenseRules.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No fixed expenses yet.{' '}
                <button onClick={onAddClick} className="cursor-pointer text-primary hover:underline">
                  Add one
                </button>
              </p>
            ) : (
              expenseRules.map((rule) => {
                const baseline = baselineValues.fixedExpenseAdjustments[rule.id] ?? rule.amountCents;
                const value = adjustments.fixedExpenseAdjustments[rule.id] ?? baseline;
                const range = getSliderRange(baseline);
                const categoryName = getCategoryName(rule.categoryId);

                return (
                  <BudgetSlider
                    key={rule.id}
                    label={`${rule.description} (${categoryName})`}
                    value={value}
                    baseline={baseline}
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    onChange={(cents) => setFixedExpenseAdjustment(rule.id, cents)}
                    cadence={rule.cadence as CadenceType}
                    variant="expense"
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

interface BudgetedSpendingSectionProps {
  budgetRules: BudgetRule[];
  categories: Category[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddClick: () => void;
  periodLabel: string;
  periodTotal: number;
}

export function BudgetedSpendingSliderSection({
  budgetRules,
  categories,
  isOpen,
  onOpenChange,
  onAddClick,
  periodLabel,
  periodTotal,
}: BudgetedSpendingSectionProps) {
  const { adjustments, baselineValues, setBudgetAdjustment } = useWhatIf();

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
            </span>
          </CollapsibleTrigger>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onAddClick(); }}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <CollapsibleContent>
          <div className="space-y-3 border-t p-4">
            {activeRules.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No budgets set yet.{' '}
                <button onClick={onAddClick} className="cursor-pointer text-primary hover:underline">
                  Add one
                </button>
              </p>
            ) : (
              activeRules.map((rule) => {
                const category = categoryMap.get(rule.categoryId);
                const categoryName = category?.name ?? 'Unknown';
                const baseline = baselineValues.budgetAdjustments[rule.categoryId] ?? rule.amountCents;
                const value = adjustments.budgetAdjustments[rule.categoryId] ?? baseline;
                const range = getSliderRange(baseline);

                return (
                  <BudgetSlider
                    key={rule.id}
                    label={categoryName}
                    value={value}
                    baseline={baseline}
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    onChange={(cents) => setBudgetAdjustment(rule.categoryId, cents)}
                    cadence={rule.cadence as CadenceType}
                    variant="expense"
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
  periodLabel: string;
  periodTotal: number;
}

export function SavingsSliderSection({
  savingsRules,
  savingsGoals,
  isOpen,
  onOpenChange,
  onAddClick,
  periodLabel,
  periodTotal,
}: SavingsSectionProps) {
  const { adjustments, baselineValues, setSavingsAdjustment } = useWhatIf();

  const getGoalName = (id: string | null) =>
    id ? savingsGoals.find((g) => g.id === id)?.name ?? 'Unknown' : 'Savings';

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
            </span>
          </CollapsibleTrigger>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onAddClick(); }}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <CollapsibleContent>
          <div className="space-y-3 border-t p-4">
            {savingsRules.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No savings contributions yet.{' '}
                <button onClick={onAddClick} className="cursor-pointer text-primary hover:underline">
                  Add one
                </button>
              </p>
            ) : (
              savingsRules.map((rule) => {
                const baseline = baselineValues.savingsAdjustments[rule.id] ?? rule.amountCents;
                const value = adjustments.savingsAdjustments[rule.id] ?? baseline;
                const range = getSliderRange(baseline);
                const goalName = getGoalName(rule.savingsGoalId);

                return (
                  <BudgetSlider
                    key={rule.id}
                    label={goalName}
                    value={value}
                    baseline={baseline}
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    onChange={(cents) => setSavingsAdjustment(rule.id, cents)}
                    cadence={rule.cadence as CadenceType}
                    variant="savings"
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
