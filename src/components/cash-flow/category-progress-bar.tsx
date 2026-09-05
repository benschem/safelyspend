import { cn } from '@/lib/utils';

interface CategoryProgressBarProps {
  /** Spent as a percentage of budget. Values over 100 fill the bar and mark it over. */
  percentage: number;
  /** The category's own colour, used while spending is within budget. */
  color: string;
  isOverBudget: boolean;
  isWarning: boolean;
}

/**
 * Spend against budget for one category. Over budget turns the bar red and caps it
 * with a darker end stop; nearing the limit turns it orange.
 */
export function CategoryProgressBar({
  percentage,
  color,
  isOverBudget,
  isWarning,
}: CategoryProgressBarProps) {
  return (
    <div className="relative h-2 rounded-full bg-muted">
      <div
        className={cn(
          'absolute h-2 rounded-full',
          isOverBudget ? 'bg-red-500' : isWarning ? 'bg-orange-500' : '',
        )}
        style={{
          width: `${Math.min(percentage, 100)}%`,
          backgroundColor: isOverBudget || isWarning ? undefined : color,
        }}
      />
      {isOverBudget && <div className="absolute right-0 h-2 w-1 rounded-r-full bg-red-700" />}
    </div>
  );
}
