import { PieChart } from 'lucide-react';
import { formatCents } from '@/lib/utils';

interface BudgetAllocationBarProps {
  income: number;
  spending: number;
  savings: number;
  surplus: number;
}

export function BudgetAllocationBar({
  income,
  spending,
  savings,
  surplus,
}: BudgetAllocationBarProps) {
  // Handle edge case: no income
  if (income <= 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No income expected for this period
      </div>
    );
  }

  // Calculate percentages
  const spendingPct = Math.round((spending / income) * 100);
  const savingsPct = Math.round((savings / income) * 100);
  const surplusPct = Math.max(0, 100 - spendingPct - savingsPct);

  // Handle overspent case (spending + savings > income)
  const isOverallocated = spending + savings > income;
  const totalAllocated = spending + savings;
  const overallocationPct = isOverallocated
    ? Math.round((totalAllocated / income) * 100)
    : 100;

  // For overspent, we need to scale the segments to fit
  const scaledSpendingPct = isOverallocated
    ? Math.round((spending / totalAllocated) * 100)
    : spendingPct;
  const scaledSavingsPct = isOverallocated
    ? Math.round((savings / totalAllocated) * 100)
    : savingsPct;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-500/10">
          <PieChart className="h-4 w-4 text-slate-500" />
        </div>
        <p className="text-sm text-muted-foreground">Planned Income Allocation</p>
      </div>

      {/* Stacked bar */}
      <div className="mt-3 h-6 overflow-hidden rounded-full bg-muted">
        <div className="flex h-full">
          {/* Spending segment */}
          {scaledSpendingPct > 0 && (
            <div
              className="h-full bg-red-500 transition-all"
              style={{ width: `${scaledSpendingPct}%` }}
            />
          )}
          {/* Savings segment */}
          {scaledSavingsPct > 0 && (
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${scaledSavingsPct}%` }}
            />
          )}
          {/* Surplus segment (only if not overallocated) */}
          {!isOverallocated && surplusPct > 0 && (
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${surplusPct}%` }}
            />
          )}
        </div>
      </div>

      {/* Overallocation warning */}
      {isOverallocated && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Budget exceeds income by {formatCents(totalAllocated - income)} ({overallocationPct - 100}%)
        </p>
      )}

      {/* Spacer to push legend to bottom */}
      <div className="flex-1" />

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-muted-foreground">Spending</span>
          <span className="font-medium">{formatCents(spending)}</span>
        </div>
        {savings > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Savings</span>
            <span className="font-medium">{formatCents(savings)}</span>
          </div>
        )}
        {!isOverallocated && surplus > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Surplus</span>
            <span className="font-medium">{formatCents(surplus)}</span>
          </div>
        )}
      </div>

      {/* No budget rules hint */}
      {spending === 0 && savings === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          No spending limits or savings goals set for this scenario
        </p>
      )}
    </div>
  );
}
