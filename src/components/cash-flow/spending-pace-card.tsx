import type { ComponentProps } from 'react';
import { BanknoteArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BurnRateChart } from '@/components/charts/burn-rate-chart';

/**
 * The burn rate chart with its card chrome and pace verdict. Everything the chart
 * itself needs is forwarded straight through, so callers pass one flat set of props.
 */
interface SpendingPaceCardProps extends ComponentProps<typeof BurnRateChart> {
  showDeltas: boolean;
  /** True when the projected spend differs from the planned spend. */
  pacesDiffer: boolean;
  projectedVariable: number | null;
  /** Planned variable spending for the period, which the projection is judged against. */
  variable: number;
}

export function SpendingPaceCard({
  showDeltas,
  pacesDiffer,
  projectedVariable,
  variable,
  ...burnRate
}: SpendingPaceCardProps) {
  const isFaster = pacesDiffer && projectedVariable !== null && projectedVariable > variable;
  const isSlower = pacesDiffer && projectedVariable !== null && projectedVariable < variable;

  return (
    <div className={cn('rounded-xl border bg-card p-6', showDeltas && 'border-violet-500/30')}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10">
            <BanknoteArrowDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </span>
          <h3 className="text-lg font-semibold">Spending Pace</h3>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
            isFaster
              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
              : 'bg-green-500/10 text-green-600 dark:text-green-400',
          )}
        >
          {isFaster ? 'Faster than planned' : isSlower ? 'Less than planned' : 'On track'}
        </span>
      </div>
      <BurnRateChart {...burnRate} />
    </div>
  );
}
