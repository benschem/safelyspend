import { LineChart, Line, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCents, cn } from '@/lib/utils';
import type { MonthSummary } from '@/hooks/use-multi-period-summary';

interface TrendSparklineProps {
  data: MonthSummary[];
  onMonthClick?: (monthIndex: number, year: number) => void;
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

export function TrendSparkline({ data, onMonthClick }: TrendSparklineProps) {
  if (data.length === 0) return null;

  // Note: Y-axis is auto-scaled by recharts based on data values

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={56}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="3 3" />
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
        </LineChart>
      </ResponsiveContainer>
      {/* Month labels */}
      <div className="flex justify-between px-2 text-[10px] text-muted-foreground">
        {data.length > 0 && (
          <>
            <span>{data[0]?.shortLabel}</span>
            <span>{data[Math.floor(data.length / 2)]?.shortLabel}</span>
            <span>{data[data.length - 1]?.shortLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}
