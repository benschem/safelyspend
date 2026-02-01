import { cn, formatCents } from '@/lib/utils';
import type { MonthSummary } from '@/hooks/use-multi-period-summary';

interface YearGridProps {
  year: number;
  months: MonthSummary[];
  onMonthClick: (monthIndex: number) => void;
}

export function YearGrid({ year, months, onMonthClick }: YearGridProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">{year} Overview</h2>
        <p className="text-sm text-muted-foreground">Click a month to view details</p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {months.map((month) => (
          <button
            key={month.month}
            type="button"
            onClick={() => onMonthClick(month.monthIndex)}
            className={cn(
              'cursor-pointer rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50',
              month.isCurrentMonth && 'border-primary ring-1 ring-primary/20',
              month.isFuture && 'opacity-60',
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">{month.shortLabel}</p>
            <p
              className={cn(
                'mt-1 text-sm font-semibold',
                month.surplus >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {month.surplus >= 0 ? '+' : ''}
              {formatCents(month.surplus)}
            </p>
            {/* Color indicator bar */}
            <div
              className={cn(
                'mt-2 h-1 w-full rounded-full',
                month.surplus >= 0 ? 'bg-green-500/30' : 'bg-red-500/30',
              )}
            >
              <div
                className={cn(
                  'h-1 rounded-full',
                  month.surplus >= 0 ? 'bg-green-500' : 'bg-red-500',
                )}
                style={{
                  width: month.isFuture ? '100%' : '100%',
                }}
              />
            </div>
            {month.isCurrentMonth && (
              <p className="mt-1 text-[10px] text-blue-600 dark:text-blue-400">Now</p>
            )}
            {month.isFuture && !month.isCurrentMonth && (
              <p className="mt-1 text-[10px] text-violet-600 dark:text-violet-400">Projected</p>
            )}
            {month.isPast && !month.isCurrentMonth && (
              <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">Historical</p>
            )}
          </button>
        ))}
      </div>

      {/* Year summary */}
      <div className="rounded-lg border bg-muted/30 p-4 text-center">
        <p className="text-sm text-muted-foreground">Year total</p>
        <p
          className={cn(
            'text-xl font-bold',
            months.reduce((sum, m) => sum + m.surplus, 0) >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400',
          )}
        >
          {months.reduce((sum, m) => sum + m.surplus, 0) >= 0 ? '+' : ''}
          {formatCents(months.reduce((sum, m) => sum + m.surplus, 0))}
        </p>
      </div>
    </div>
  );
}
