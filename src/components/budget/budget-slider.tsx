import { useCallback, useState, useEffect, type ReactNode } from 'react';
import { Slider } from '@/components/ui/slider';
import { cn, formatCents, CADENCE_SHORT_LABELS, type CadenceType } from '@/lib/utils';

export type SliderVariant = 'income' | 'expense' | 'savings';

interface BudgetSliderProps {
  /** Label shown on the left */
  label: string;
  /** Current (adjusted) value in cents */
  value: number;
  /** Original value for delta display */
  baseline: number;
  /** Minimum value in cents */
  min: number;
  /** Maximum value in cents */
  max: number;
  /** Step size in cents (e.g., 1000 for $10 increments) */
  step: number;
  /** Called when value changes */
  onChange: (cents: number) => void;
  /** Cadence for display (e.g., "/month") */
  cadence: CadenceType;
  /** Color variant */
  variant?: SliderVariant;
  /** Optional icon */
  icon?: ReactNode;
  /** Debounce delay in ms (default 100) */
  debounceMs?: number;
}

const variantStyles: Record<SliderVariant, { track: string; thumb: string; text: string }> = {
  income: {
    track: '[&_[data-radix-slider-range]]:bg-green-500',
    thumb: '[&_[data-radix-slider-thumb]]:border-green-500',
    text: 'text-green-600 dark:text-green-400',
  },
  expense: {
    track: '[&_[data-radix-slider-range]]:bg-rose-500',
    thumb: '[&_[data-radix-slider-thumb]]:border-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
  },
  savings: {
    track: '[&_[data-radix-slider-range]]:bg-blue-500',
    thumb: '[&_[data-radix-slider-thumb]]:border-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
  },
};

export function BudgetSlider({
  label,
  value,
  baseline,
  min,
  max,
  step,
  onChange,
  cadence,
  variant = 'expense',
  icon,
  debounceMs = 100,
}: BudgetSliderProps) {
  // Internal state for immediate UI feedback
  const [localValue, setLocalValue] = useState(value);

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced onChange
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleChange = useCallback(
    (newValue: number[]) => {
      const v = newValue[0] ?? 0;
      setLocalValue(v);

      // Clear existing timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // Set new timeout
      const timeout = setTimeout(() => {
        onChange(v);
      }, debounceMs);
      setDebounceTimeout(timeout);
    },
    [onChange, debounceMs, debounceTimeout],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [debounceTimeout]);

  const delta = localValue - baseline;
  const hasAdjustment = delta !== 0;
  const styles = variantStyles[variant];

  // Calculate baseline marker position (percentage along the track)
  const baselinePercent = max > min ? ((baseline - min) / (max - min)) * 100 : 0;

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        hasAdjustment && 'border-violet-300 bg-violet-50/50 dark:border-violet-700 dark:bg-violet-950/20',
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <span className="font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('font-semibold tabular-nums', styles.text)}>
            {formatCents(localValue)}
          </span>
          <span className="text-sm text-muted-foreground">
            {CADENCE_SHORT_LABELS[cadence]}
          </span>
        </div>
      </div>

      {/* Slider with baseline marker */}
      <div className="relative">
        <Slider
          value={[localValue]}
          min={min}
          max={max}
          step={step}
          onValueChange={handleChange}
          className={cn('cursor-pointer', styles.track, styles.thumb)}
        />
        {/* Baseline marker - shows original value position */}
        {hasAdjustment && (
          <div
            className="pointer-events-none absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-gray-400 dark:bg-gray-500"
            style={{ left: `${baselinePercent}%` }}
            title={`Original: ${formatCents(baseline)}`}
          />
        )}
      </div>

      {hasAdjustment && (
        <div className="mt-2 flex justify-end">
          <span
            className={cn(
              'text-sm font-medium',
              delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-rose-600 dark:text-rose-400',
            )}
          >
            {delta > 0 ? '+' : ''}
            {formatCents(delta)}
            {CADENCE_SHORT_LABELS[cadence]}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Calculate appropriate slider range based on current value
 */
export function getSliderRange(value: number): { min: number; max: number; step: number } {
  // Minimum is 0 for expenses/savings, 50% for income
  const min = 0;

  // Maximum is 200% of current value, with a minimum of $100
  const max = Math.max(value * 2, 10000); // At least $100

  // Step size: $10 for values < $500, $50 for larger
  const step = value < 50000 ? 1000 : 5000;

  return { min, max, step };
}

/**
 * Calculate income-appropriate slider range (min is 50% of current)
 */
export function getIncomeSliderRange(value: number): { min: number; max: number; step: number } {
  const min = Math.round(value * 0.5);
  const max = Math.round(value * 2);
  const step = value < 50000 ? 1000 : 5000;

  return { min, max, step };
}
