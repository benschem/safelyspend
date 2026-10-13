import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, formatCents, CADENCE_PER_LABELS, type CadenceType } from '@/lib/utils';
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

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
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

interface PlanRowProps {
  label: string;
  /** Optional link destination for the label */
  labelHref?: string | undefined;
  /** Optional muted line under the label, such as when a bill is due */
  hint?: string | null;
  amountCents: number;
  cadence: CadenceType;
  /** Edit and delete buttons, shown beside the label */
  actions: ReactNode;
}

/** One income source, expense or savings contribution: what it is and how much. */
function PlanRow({ label, labelHref, hint, amountCents, cadence, actions }: PlanRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {labelHref ? (
            <Link to={labelHref} className="hover:underline">
              {label}
            </Link>
          ) : (
            <span>{label}</span>
          )}
          {actions}
        </div>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0 text-right">
        <span className="tabular-nums">{formatCents(amountCents)}</span>{' '}
        <span className="text-sm text-muted-foreground">{CADENCE_PER_LABELS[cadence]}</span>
      </div>
    </div>
  );
}

/** The message a section shows in place of its rows when it has none. */
function EmptySection({ message, onAddClick }: { message: string; onAddClick: () => void }) {
  return (
    <p className="rounded-lg border py-6 text-center text-sm text-muted-foreground">
      {message}{' '}
      <button onClick={onAddClick} className="cursor-pointer text-primary hover:underline">
        Add one
      </button>
    </p>
  );
}

interface IncomeSectionProps {
  incomeRules: ForecastRule[];
  onAddClick: () => void;
  onEditRule: (rule: ForecastRule) => void;
  onDeleteRule: (ruleId: string) => void;
}

export function IncomeSection({
  incomeRules,
  onAddClick,
  onEditRule,
  onDeleteRule,
}: IncomeSectionProps) {
  if (incomeRules.length === 0) {
    return <EmptySection message="No income sources yet." onAddClick={onAddClick} />;
  }

  return (
    <div className="divide-y rounded-lg border px-4">
      {incomeRules.map((rule) => (
        <PlanRow
          key={rule.id}
          label={rule.description}
          amountCents={rule.amountCents}
          cadence={rule.cadence as CadenceType}
          actions={
            <RowActions onEdit={() => onEditRule(rule)} onDelete={() => onDeleteRule(rule.id)} />
          }
        />
      ))}
    </div>
  );
}

interface ExpensesSectionProps {
  /** Expenses with a due date */
  billRules: ForecastRule[];
  /** Expenses without one */
  allowanceRules: BudgetRule[];
  categories: Category[];
  onAddClick: () => void;
  /** Adds an expense from a category's heading, with that category chosen */
  onAddToCategory: (categoryId: string) => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
  /** The period the category totals are quoted over, which periodLabel names */
  period: Cadence;
  periodLabel: string;
  /** What each category has cost on average, shown under its heading */
  spendingAverages: SpendingAverages | null;
}

export function ExpensesSection({
  billRules,
  allowanceRules,
  categories,
  spendingAverages,
  onAddClick,
  onAddToCategory,
  onEditExpense,
  onDeleteExpense,
  period,
  periodLabel,
}: ExpensesSectionProps) {
  const expenseGroups = useMemo(
    () => groupExpensesByCategory(billRules, allowanceRules, categories),
    [billRules, allowanceRules, categories],
  );

  if (expenseGroups.length === 0) {
    return <EmptySection message="No expenses yet." onAddClick={onAddClick} />;
  }

  return (
    <div className="space-y-4">
      {expenseGroups.map((group) => {
        const averageSpendingHint = group.categoryId
          ? describeAverageSpending(spendingAverages, group.categoryId, period)
          : null;
        const groupTotal =
          sumForecastRulesForPeriod(group.bills, 'expense', period) +
          sumAllowancesForPeriod(group.allowances, period);
        const hasExpenses = group.bills.length > 0 || group.allowances.length > 0;
        const { categoryId } = group;

        return (
          <div
            key={categoryId ?? UNCATEGORISED_LABEL}
            className="overflow-hidden rounded-lg border"
          >
            <div className="bg-muted/50 px-4 py-3">
              <div className="flex items-center justify-between gap-2 font-semibold">
                {group.categoryId ? (
                  <Link
                    to={`/categories/${group.categoryId}?from=budget`}
                    className="hover:underline"
                  >
                    {group.name}
                  </Link>
                ) : (
                  <span>{group.name}</span>
                )}
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">
                    {formatCents(groupTotal)} {periodLabel}
                  </span>
                  {categoryId && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => onAddToCategory(categoryId)}
                            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={`Add expense to ${group.name}`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Add expense</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
              {averageSpendingHint && (
                <p className="mt-1 text-sm text-muted-foreground">{averageSpendingHint}</p>
              )}
            </div>
            <div className={cn('divide-y px-4', hasExpenses && 'border-t')}>
              {group.bills.map((rule) => (
                <PlanRow
                  key={rule.id}
                  label={rule.description}
                  hint={describeBillDue(rule)}
                  amountCents={rule.amountCents}
                  cadence={rule.cadence as CadenceType}
                  actions={
                    <RowActions
                      onEdit={() => onEditExpense({ kind: 'bill', rule })}
                      onDelete={() => onDeleteExpense({ kind: 'bill', rule })}
                    />
                  }
                />
              ))}
              {group.allowances.map((rule) => (
                <PlanRow
                  key={rule.id}
                  label={allowanceLabel(rule)}
                  amountCents={rule.amountCents}
                  cadence={rule.cadence as CadenceType}
                  actions={
                    <RowActions
                      onEdit={() => onEditExpense({ kind: 'allowance', rule })}
                      onDelete={() => onDeleteExpense({ kind: 'allowance', rule })}
                    />
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface SavingsSectionProps {
  savingsRules: ForecastRule[];
  savingsGoals: SavingsGoal[];
  onAddClick: () => void;
  onEditRule: (rule: ForecastRule) => void;
  onDeleteRule: (ruleId: string) => void;
}

export function SavingsSection({
  savingsRules,
  savingsGoals,
  onAddClick,
  onEditRule,
  onDeleteRule,
}: SavingsSectionProps) {
  const getGoalName = (id: string | null) =>
    id ? (savingsGoals.find((g) => g.id === id)?.name ?? 'Unknown') : 'Savings';

  if (savingsRules.length === 0) {
    return <EmptySection message="No savings contributions yet." onAddClick={onAddClick} />;
  }

  return (
    <div className="divide-y rounded-lg border px-4">
      {savingsRules.map((rule) => (
        <PlanRow
          key={rule.id}
          label={getGoalName(rule.savingsGoalId)}
          labelHref="/savings"
          amountCents={rule.amountCents}
          cadence={rule.cadence as CadenceType}
          actions={
            <RowActions onEdit={() => onEditRule(rule)} onDelete={() => onDeleteRule(rule.id)} />
          }
        />
      ))}
    </div>
  );
}
