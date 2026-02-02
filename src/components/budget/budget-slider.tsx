import { useCallback, useState, useEffect, type ReactNode } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn, formatCents, centsToDollars, dollarsToCents, CADENCE_PER_LABELS, type CadenceType } from '@/lib/utils';

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
  /** Cadence for display (e.g., "per month") */
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
  // Custom value input state
  const [customInputOpen, setCustomInputOpen] = useState(false);
  const [customInputValue, setCustomInputValue] = useState('');

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

  // Handle custom value submission
  const handleCustomValueSubmit = useCallback(() => {
    const dollars = parseFloat(customInputValue.replace(/[^0-9.]/g, ''));
    if (!isNaN(dollars) && dollars >= 0) {
      const cents = dollarsToCents(dollars);
      setLocalValue(cents);
      onChange(cents);
      setCustomInputOpen(false);
      setCustomInputValue('');
    }
  }, [customInputValue, onChange]);

  // Open custom input with current value pre-filled
  const openCustomInput = useCallback(() => {
    setCustomInputValue(centsToDollars(localValue).toString());
    setCustomInputOpen(true);
  }, [localValue]);

  const delta = localValue - baseline;
  const hasAdjustment = delta !== 0;
  const styles = variantStyles[variant];
  const perLabel = CADENCE_PER_LABELS[cadence];

  // Calculate baseline marker position (percentage along the track)
  const baselinePercent = max > min ? ((baseline - min) / (max - min)) * 100 : 0;

  // Check if at slider limits
  const isAtMax = localValue >= max;
  const isAtMin = localValue <= min;
  const isAtLimit = isAtMax || isAtMin;

  // Delta text and color based on variant
  const getDeltaDisplay = () => {
    const absDelta = Math.abs(delta);
    const formattedDelta = formatCents(absDelta);

    if (variant === 'income') {
      // Income: green when earning more, red when earning less
      if (delta > 0) {
        return {
          text: `earning ${formattedDelta} extra ${perLabel}`,
          className: 'text-green-600 dark:text-green-400',
        };
      } else {
        return {
          text: `earning ${formattedDelta} less ${perLabel}`,
          className: 'text-rose-600 dark:text-rose-400',
        };
      }
    } else if (variant === 'expense') {
      // Expense: green when spending less (good), red when spending more (bad)
      if (delta < 0) {
        return {
          text: `spending ${formattedDelta} less ${perLabel}`,
          className: 'text-green-600 dark:text-green-400',
        };
      } else {
        return {
          text: `spending ${formattedDelta} more ${perLabel}`,
          className: 'text-rose-600 dark:text-rose-400',
        };
      }
    } else {
      // Savings: always blue
      if (delta > 0) {
        return {
          text: `saving ${formattedDelta} more ${perLabel}`,
          className: 'text-blue-600 dark:text-blue-400',
        };
      } else {
        return {
          text: `saving ${formattedDelta} less ${perLabel}`,
          className: 'text-blue-600 dark:text-blue-400',
        };
      }
    }
  };

  const deltaDisplay = hasAdjustment ? getDeltaDisplay() : null;

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
          <Popover open={customInputOpen} onOpenChange={setCustomInputOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={openCustomInput}
                className={cn(
                  'cursor-pointer rounded px-1 font-semibold tabular-nums transition-colors hover:bg-muted',
                  styles.text,
                )}
                title="Click to enter custom value"
              >
                {formatCents(localValue)}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-3" align="end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Custom amount</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={customInputValue}
                    onChange={(e) => setCustomInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCustomValueSubmit();
                      }
                    }}
                    placeholder="0"
                    className="h-8"
                    autoFocus
                  />
                  <Button size="sm" className="h-8" onClick={handleCustomValueSubmit}>
                    Set
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <span className="text-sm text-muted-foreground">
            {perLabel}
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

      {/* Limit hint */}
      {isAtLimit && (
        <div className="mt-1 text-right">
          <button
            type="button"
            onClick={openCustomInput}
            className="cursor-pointer text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {isAtMax ? 'Need more? Click to enter custom value' : 'At minimum'}
          </button>
        </div>
      )}

      {deltaDisplay && (
        <div className="mt-2 flex justify-end">
          <span className={cn('text-sm font-medium', deltaDisplay.className)}>
            {deltaDisplay.text}
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
  // Minimum is 0 for expenses/savings
  const min = 0;

  // Maximum is 200% of current value, with a minimum of $100
  const max = Math.max(value * 2, 10000); // At least $100

  // Step size: $10 for values < $500, $50 for larger
  const step = value < 50000 ? 1000 : 5000;

  return { min, max, step };
}

/**
 * Calculate income-appropriate slider range
 * Now allows going to $0 like other types
 */
export function getIncomeSliderRange(value: number): { min: number; max: number; step: number } {
  const min = 0; // Allow $0 income
  const max = Math.max(value * 2, 10000); // At least $100
  const step = value < 50000 ? 1000 : 5000;

  return { min, max, step };
}
