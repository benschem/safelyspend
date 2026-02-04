import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  ReferenceArea,
} from 'recharts';
import { formatCents, cn } from '@/lib/utils';
import type { MonthSummary } from '@/hooks/use-multi-period-summary';

interface TrendSparklineProps {
  data: MonthSummary[];
  onMonthClick?: (monthIndex: number, year: number) => void;
  /** Show a reference line at the current/selected month */
  showNowLine?: boolean;
  /** Currently selected month (to highlight and label) */
  selectedMonth?: { monthIndex: number; year: number };
}

interface CustomDotProps {
  cx: number | undefined;
  cy: number | undefined;
  payload: MonthSummary | undefined;
  onClick: ((monthIndex: number, year: number) => void) | undefined;
  isSelected: boolean;
}

function CustomDot({ cx, cy, payload, onClick, isSelected }: CustomDotProps) {
  if (!cx || !cy || !payload) return null;

  const isPositive = payload.surplus >= 0;
  const color = isPositive ? '#22c55e' : '#ef4444'; // green-500 / red-500
  const isHighlighted = isSelected || payload.isCurrentMonth;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={isHighlighted ? 5 : 3}
      fill={color}
      stroke={isHighlighted ? '#fff' : 'none'}
      strokeWidth={isHighlighted ? 2 : 0}
      className="cursor-pointer transition-all hover:r-4"
      onClick={() => onClick?.(payload.monthIndex, payload.year)}
    />
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: MonthSummary }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null;

  const data = payload[0].payload;
  const isPositive = data.surplus >= 0;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">
        {data.label} {data.year}
      </p>
      <p className={cn('font-mono', isPositive ? 'text-green-600' : 'text-red-600')}>
        {isPositive ? '+' : ''}
        {formatCents(data.surplus)}
      </p>
      {data.isCurrentMonth && (
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Today</p>
      )}
      {data.isFuture && !data.isCurrentMonth && (
        <p className="text-xs text-violet-600 dark:text-violet-400">Projected</p>
      )}
      {data.isPast && !data.isCurrentMonth && (
        <p className="text-xs text-slate-500 dark:text-slate-400">Historical</p>
      )}
    </div>
  );
}

interface DotRenderProps {
  cx?: number;
  cy?: number;
  payload?: MonthSummary;
}

export function TrendSparkline({
  data,
  onMonthClick,
  showNowLine = false,
  selectedMonth,
}: TrendSparklineProps) {
  // Find the current month index for the "Now" line
  const currentMonthIndex = useMemo(() => {
    return data.findIndex((d) => d.isCurrentMonth);
  }, [data]);

  // Find the selected month index (if different from current)
  const selectedMonthIndex = useMemo(() => {
    if (!selectedMonth) return -1;
    return data.findIndex(
      (d) => d.monthIndex === selectedMonth.monthIndex && d.year === selectedMonth.year,
    );
  }, [data, selectedMonth]);

  // Add index to data for x-axis positioning
  const chartData = useMemo(() => {
    return data.map((d, i) => ({ ...d, index: i }));
  }, [data]);

  if (data.length === 0) return null;

  // Determine which month to highlight and label
  const isViewingCurrentMonth =
    selectedMonthIndex === currentMonthIndex || selectedMonthIndex === -1;
  const highlightIndex = selectedMonthIndex >= 0 ? selectedMonthIndex : currentMonthIndex;
  const highlightedMonth = highlightIndex >= 0 ? data[highlightIndex] : null;

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={64}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          {/* Future months shaded area - purple for projections */}
          {showNowLine && currentMonthIndex >= 0 && currentMonthIndex < data.length - 1 && (
            <ReferenceArea
              x1={currentMonthIndex}
              x2={data.length - 1}
              fill="#8b5cf6"
              fillOpacity={0.08}
            />
          )}
          <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
          {/* "Now" vertical line (always at current month) - gray for neutral current position */}
          {showNowLine && currentMonthIndex >= 0 && (
            <ReferenceLine x={currentMonthIndex} stroke="#6b7280" strokeWidth={2} />
          )}
          {/* Selected month vertical line (if different from current) */}
          {selectedMonthIndex >= 0 && selectedMonthIndex !== currentMonthIndex && (
            <ReferenceLine x={selectedMonthIndex} stroke="#6b7280" strokeWidth={2} />
          )}
          <Line
            type="monotone"
            dataKey="surplus"
            stroke="#9ca3af"
            strokeWidth={1.5}
            dot={(props: DotRenderProps) => {
              const isSelected =
                selectedMonthIndex >= 0 &&
                props.payload?.monthIndex === selectedMonth?.monthIndex &&
                props.payload?.year === selectedMonth?.year;
              return (
                <CustomDot
                  key={props.payload?.month}
                  cx={props.cx}
                  cy={props.cy}
                  payload={props.payload}
                  onClick={onMonthClick}
                  isSelected={isSelected}
                />
              );
            }}
            activeDot={false}
          />
          <Tooltip content={<CustomTooltip />} />
        </ComposedChart>
      </ResponsiveContainer>
      {/* Labels row */}
      <div className="flex items-center justify-between px-2 text-[10px] text-muted-foreground">
        <span>
          {data[0]?.shortLabel} {data[0]?.year !== data[data.length - 1]?.year ? data[0]?.year : ''}
        </span>
        {showNowLine && highlightedMonth && (
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-1.5 py-0.5',
              isViewingCurrentMonth
                ? 'bg-gray-500/15 font-medium text-gray-600 dark:text-gray-400'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {isViewingCurrentMonth
              ? 'Today'
              : `${highlightedMonth.shortLabel} ${highlightedMonth.year}`}
          </span>
        )}
        <span>
          {data[data.length - 1]?.shortLabel}{' '}
          {data[0]?.year !== data[data.length - 1]?.year ? data[data.length - 1]?.year : ''}
        </span>
      </div>
    </div>
  );
}
