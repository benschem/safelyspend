import { Banknote, CreditCard, Scale, Sparkles } from 'lucide-react';
import { cn, formatCents } from '@/lib/utils';

export type BudgetStatus = 'shortfall' | 'balanced' | 'surplus';

interface BudgetStatusHeroProps {
  scenarioName: string;
  /** Null when no headline applies, leaving just the scenario pill. */
  status: BudgetStatus | null;
  /** What is left over, or the size of the shortfall. Ignored when balanced. */
  amountCents: number;
  /** The cadence the figure is quoted at, e.g. "per month". */
  periodLabel: string;
}

const STATUS_HEADINGS = {
  shortfall: { label: 'Planned Shortfall', icon: CreditCard, color: 'text-amber-500' },
  balanced: { label: 'Budget Balanced', icon: Scale, color: 'text-green-500' },
  surplus: { label: 'Planned Surplus', icon: Banknote, color: 'text-green-500' },
} as const;

/**
 * The headline figure at the top of the budget plan: what is left once income,
 * bills and savings are accounted for.
 */
export function BudgetStatusHero({
  scenarioName,
  status,
  amountCents,
  periodLabel,
}: BudgetStatusHeroProps) {
  const heading = status ? STATUS_HEADINGS[status] : null;

  return (
    <div className="min-h-28 text-center sm:min-h-32">
      <div className="flex min-h-8 items-center justify-center">
        <span className="flex items-center gap-1 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-600 dark:text-violet-400">
          <Sparkles className="h-3 w-3" />
          {scenarioName}
        </span>
      </div>
      {heading && (
        <div className="mt-4">
          <p
            className={cn(
              'flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide',
              heading.color,
            )}
          >
            <heading.icon className="h-4 w-4" />
            {heading.label}
          </p>
          <p className={cn('mt-2 text-5xl font-bold tracking-tight', heading.color)}>
            {status === 'balanced'
              ? 'Every dollar accounted for'
              : formatCents(Math.abs(amountCents))}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{periodLabel}</p>
        </div>
      )}
    </div>
  );
}
