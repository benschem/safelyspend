import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatCents } from '@/lib/utils';
import { CHART_COLORS, getCategoryColor } from '@/lib/chart-colors';

interface BreakdownSegment {
  id: string;
  name: string;
  amount: number;
}

interface SpendingBreakdownChartProps {
  segments: BreakdownSegment[];
  total: number;
}

interface TooltipPayload {
  name: string;
  value: number;
  payload: {
    name: string;
    value: number;
    fill: string;
  };
}

function CustomTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  total: number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0];
  if (!data) return null;

  const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0';

  return (
    <div className="rounded-lg border bg-background p-2 shadow-sm">
      <p className="font-medium">{data.name}</p>
      <p className="text-sm text-muted-foreground">
        {formatCents(data.value)} ({percentage}%)
      </p>
    </div>
  );
}

export function SpendingBreakdownChart({ segments, total }: SpendingBreakdownChartProps) {
  // Build color map for segments
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    let categoryIndex = 0;

    for (const segment of segments) {
      if (segment.id === 'savings') {
        map[segment.id] = CHART_COLORS.savings;
      } else if (segment.id === 'uncategorized') {
        map[segment.id] = CHART_COLORS.uncategorized;
      } else if (segment.id === 'unallocated') {
        map[segment.id] = CHART_COLORS.available;
      } else {
        map[segment.id] = getCategoryColor(categoryIndex);
        categoryIndex++;
      }
    }
    return map;
  }, [segments]);

  // Transform data for horizontal stacked bar
  const chartData = useMemo(() => {
    const dataPoint: Record<string, number | string> = { name: 'Spending' };
    for (const segment of segments) {
      dataPoint[segment.id] = segment.amount;
    }
    return [dataPoint];
  }, [segments]);

  if (total === 0 || segments.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={40}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <XAxis type="number" hide domain={[0, total]} />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip
            content={<CustomTooltip total={total} />}
            cursor={{ fill: 'transparent' }}
          />
          {segments.map((segment) => (
            <Bar
              key={segment.id}
              dataKey={segment.id}
              stackId="spending"
              name={segment.name}
              radius={0}
            >
              <Cell fill={colorMap[segment.id] ?? CHART_COLORS.uncategorized} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((segment) => {
          const percentage = ((segment.amount / total) * 100).toFixed(0);
          return (
            <div key={segment.id} className="flex items-center gap-1.5 text-xs">
              <div
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: colorMap[segment.id] ?? CHART_COLORS.uncategorized }}
              />
              <span>
                {segment.name} ({percentage}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
