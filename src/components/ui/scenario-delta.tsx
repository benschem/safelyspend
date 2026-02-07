import { formatCents } from '@/lib/utils';

interface ScenarioDeltaProps {
  /** Delta in cents (positive = increase from default, negative = decrease) */
  delta: number;
  /** Period label (default: " per month") */
  periodLabel?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the delta (when false, reserves space but hides content) */
  show?: boolean;
  /** Name of the scenario being compared to */
  comparedToName?: string;
}

/**
 * Displays a delta value comparing current scenario to the default scenario.
 * Shows "$500 per month more than [Scenario Name]" in purple.
 * Always renders to reserve space (invisible when delta is 0 or show is false).
 */
export function ScenarioDelta({
  delta,
  periodLabel = ' per month',
  className = '',
  show = true,
  comparedToName = 'Default',
}: ScenarioDeltaProps) {
  const absDelta = formatCents(Math.abs(delta));
  const direction = delta > 0 ? 'more' : 'less';
  const isVisible = show && delta !== 0;

  return (
    <p
      className={`text-xs ${isVisible ? 'text-violet-600 dark:text-violet-400' : 'invisible'} ${className}`}
    >
      {absDelta}
      {periodLabel} {direction} than {comparedToName}
    </p>
  );
}
