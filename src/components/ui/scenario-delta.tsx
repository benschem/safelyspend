import { formatCents } from '@/lib/utils';

interface ScenarioDeltaProps {
  /** Delta in cents (positive = increase from default, negative = decrease) */
  delta: number;
  /** Period label (default: "/mo") */
  periodLabel?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the delta (when false, reserves space but hides content) */
  show?: boolean;
}

/**
 * Displays a delta value comparing current scenario to the default "Current Plan".
 * Shows "+$500/mo current plan" or "-$200/mo current plan" in purple.
 * Always renders to reserve space (invisible when delta is 0 or show is false).
 */
export function ScenarioDelta({
  delta,
  periodLabel = '/mo',
  className = '',
  show = true,
}: ScenarioDeltaProps) {
  const absDelta = formatCents(Math.abs(delta));
  const direction = delta > 0 ? 'more' : 'less';
  const isVisible = show && delta !== 0;

  return (
    <p
      className={`text-xs ${isVisible ? 'text-violet-600 dark:text-violet-400' : 'invisible'} ${className}`}
    >
      {absDelta}
      {periodLabel} {direction} than current plan
    </p>
  );
}
