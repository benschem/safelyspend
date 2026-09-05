import type { LucideIcon } from 'lucide-react';
import { cn, formatCents } from '@/lib/utils';
import { ScenarioDelta } from '@/components/ui/scenario-delta';

type SummaryTone = 'income' | 'expense' | 'savings';

const TONE_CLASSES: Record<SummaryTone, { background: string; icon: string }> = {
  income: { background: 'bg-green-500/10', icon: 'text-green-500' },
  expense: { background: 'bg-red-500/10', icon: 'text-red-500' },
  savings: { background: 'bg-blue-500/10', icon: 'text-blue-500' },
};

interface BudgetSummaryCardProps {
  label: string;
  icon: LucideIcon;
  tone: SummaryTone;
  /** Null renders an em dash, for a total the user has not set up yet. */
  amountCents: number | null;
  /** Usually a share of income, e.g. "39% of income". */
  subtitle?: string | undefined;
  /**
   * Whether this total differs from the plan, which tints the figure. Separate from
   * `delta` because that is suppressed while viewing the default scenario, and the
   * tint still needs to show in what-if mode.
   */
  differsFromPlan: boolean;
  delta: number;
  showDelta: boolean;
  comparedToName: string;
  /** Given, the card becomes a button. Without it the card is static. */
  onClick?: (() => void) | undefined;
}

/**
 * One total on the budget plan: income, fixed expenses, budgeted spending or
 * savings. The figure turns violet when this scenario differs from the plan.
 */
export function BudgetSummaryCard({
  label,
  icon: Icon,
  tone,
  amountCents,
  subtitle,
  differsFromPlan,
  delta,
  showDelta,
  comparedToName,
  onClick,
}: BudgetSummaryCardProps) {
  const tones = TONE_CLASSES[tone];

  const content = (
    <>
      <div className="flex items-center gap-2">
        <div
          className={cn('flex h-8 w-8 items-center justify-center rounded-full', tones.background)}
        >
          <Icon className={cn('h-4 w-4', tones.icon)} />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p
        className={cn(
          'mt-2 text-2xl font-bold',
          differsFromPlan && 'text-violet-600 dark:text-violet-400',
        )}
      >
        {amountCents === null ? '—' : formatCents(amountCents)}
      </p>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      <ScenarioDelta delta={delta} show={showDelta} comparedToName={comparedToName} />
    </>
  );

  if (!onClick) {
    return <div className="rounded-xl border bg-card p-5 text-left">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-xl border bg-card p-5 text-left transition-colors hover:bg-muted/50"
    >
      {content}
    </button>
  );
}
