import { useMemo } from 'react';
import { ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, ReferenceArea } from 'recharts';
import { formatCents, cn } from '@/lib/utils';
import type { MonthSummary } from '@/hooks/use-multi-period-summary';

interface TrendSparklineProps {
  data: MonthSummary[];
  onMonthClick?: (monthIndex: number, year: number) => void;
  /** Show a "Now" reference line at the current month */
  showNowLine?: boolean;
}

interface CustomDotProps {
  cx: number | undefined;
  cy: number | undefined;
  payload: MonthSummary | undefined;
  onClick: ((monthIndex: number, year: number) => void) | undefined;
}

function CustomDot({ cx, cy, payload, onClick }: CustomDotProps) {
  if (!cx || !cy || !payload) return null;

  const isPositive = payload.surplus >= 0;
  const color = isPositive ? '#22c55e' : '#ef4444'; // green-500 / red-500

  return (
    <circle
      cx={cx}
      cy={cy}
      r={payload.isCurrentMonth ? 5 : 3}
      fill={color}
      stroke={payload.isCurrentMonth ? '#fff' : 'none'}
      strokeWidth={payload.isCurrentMonth ? 2 : 0}
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
      <p className="font-medium">{data.label} {data.year}</p>
      <p className={cn(
        'font-mono',
        isPositive ? 'text-green-600' : 'text-red-600',
      )}>
        {isPositive ? '+' : ''}{formatCents(data.surplus)}
      </p>
      {data.isFuture && (
        <p className="text-xs text-muted-foreground">Projected</p>
      )}
    </div>
  );
}

export function TrendSparkline({ data, onMonthClick, showNowLine = false }: TrendSparklineProps) {
  if (data.length === 0) return null;

  // Find the current month index for the "Now" line
  const currentMonthIndex = useMemo(() => {
    return data.findIndex((d) => d.isCurrentMonth);
  }, [data]);

  // Add index to data for x-axis positioning
  const chartData = useMemo(() => {
    return data.map((d, i) => ({ ...d, index: i }));
  }, [data]);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={64}>
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          {/* Future months shaded area */}
          {showNowLine && currentMonthIndex >= 0 && currentMonthIndex < data.length - 1 && (
            <ReferenceArea
              x1={currentMonthIndex}
              x2={data.length - 1}
              fill="#3b82f6"
              fillOpacity={0.05}
            />
          )}
          <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="3 3" />
          {/* "Now" vertical line */}
          {showNowLine && currentMonthIndex >= 0 && (
            <ReferenceLine
              x={currentMonthIndex}
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="3 3"
            />
          )}
          <Line
            type="monotone"
            dataKey="surplus"
            stroke="#9ca3af"
            strokeWidth={1.5}
            dot={(props) => (
              <CustomDot
                key={props.payload?.month}
                cx={props.cx}
                cy={props.cy}
                payload={props.payload}
                onClick={onMonthClick}
              />
            )}
            activeDot={false}
          />
          <Tooltip content={<CustomTooltip />} />
        </ComposedChart>
      </ResponsiveContainer>
      {/* Labels row */}
      <div className="flex items-center justify-between px-2 text-[10px] text-muted-foreground">
        <span>{data[0]?.shortLabel} {data[0]?.year !== data[data.length - 1]?.year ? data[0]?.year : ''}</span>
        {showNowLine && currentMonthIndex >= 0 && (
          <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-blue-600 dark:text-blue-400">
            Now
          </span>
        )}
        <span>{data[data.length - 1]?.shortLabel} {data[0]?.year !== data[data.length - 1]?.year ? data[data.length - 1]?.year : ''}</span>
      </div>
    </div>
  );
}
