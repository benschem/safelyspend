import { useMemo, type ReactNode } from 'react';
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
import { formatCents, CADENCE_PER_LABELS, type CadenceType } from '@/lib/utils';
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

interface IncomeSectionProps {
  incomeRules: ForecastRule[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddClick: () => void;
  onEditRule: (rule: ForecastRule) => void;
  onDeleteRule: (ruleId: string) => void;
  periodLabel: string;
  periodTotal: number;
}

export function IncomeSection({
  incomeRules,
  isOpen,
  onOpenChange,
  onAddClick,
  onEditRule,
  onDeleteRule,
  periodLabel,
  periodTotal,
}: IncomeSectionProps) {
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
          <div className="border-t px-4 py-1">
            {incomeRules.length === 0 ? (
              <p className="py-5 text-center text-sm text-muted-foreground">
                No income sources yet.{' '}
                <button
                  onClick={onAddClick}
                  className="cursor-pointer text-primary hover:underline"
                >
                  Add one
                </button>
              </p>
            ) : (
              <div className="divide-y">
                {incomeRules.map((rule) => (
                  <PlanRow
                    key={rule.id}
                    label={rule.description}
                    amountCents={rule.amountCents}
                    cadence={rule.cadence as CadenceType}
                    actions={
                      <RowActions
                        onEdit={() => onEditRule(rule)}
                        onDelete={() => onDeleteRule(rule.id)}
                      />
                    }
                  />
                ))}
              </div>
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
  /** What each category has cost on average, shown under its heading */
  spendingAverages: SpendingAverages | null;
}

export function ExpensesSection({
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
}: ExpensesSectionProps) {
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
              {formatCents(periodTotal)} {periodLabel}
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
                const groupTotal =
                  sumForecastRulesForPeriod(group.bills, 'expense', period) +
                  sumAllowancesForPeriod(group.allowances, period);

                return (
                  <div
                    key={group.categoryId ?? UNCATEGORISED_LABEL}
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
                        <span className="tabular-nums">
                          {formatCents(groupTotal)} {periodLabel}
                        </span>
                      </div>
                      {averageSpendingHint && (
                        <p className="mt-1 text-sm text-muted-foreground">{averageSpendingHint}</p>
                      )}
                    </div>
                    <div className="divide-y border-t px-4">
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
}

export function SavingsSection({
  savingsRules,
  savingsGoals,
  isOpen,
  onOpenChange,
  onAddClick,
  onEditRule,
  onDeleteRule,
  periodLabel,
  periodTotal,
}: SavingsSectionProps) {
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
          <div className="border-t px-4 py-1">
            {savingsRules.length === 0 ? (
              <p className="py-5 text-center text-sm text-muted-foreground">
                No savings contributions yet.{' '}
                <button
                  onClick={onAddClick}
                  className="cursor-pointer text-primary hover:underline"
                >
                  Add one
                </button>
              </p>
            ) : (
              <div className="divide-y">
                {savingsRules.map((rule) => (
                  <PlanRow
                    key={rule.id}
                    label={getGoalName(rule.savingsGoalId)}
                    labelHref="/savings"
                    amountCents={rule.amountCents}
                    cadence={rule.cadence as CadenceType}
                    actions={
                      <RowActions
                        onEdit={() => onEditRule(rule)}
                        onDelete={() => onDeleteRule(rule.id)}
                      />
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
