import { useMemo, useState, useCallback, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
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
  colorMap?: Record<string, string>;
}

export function SpendingBreakdownChart({ segments, total, colorMap: externalColorMap }: SpendingBreakdownChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredSegment, setHoveredSegment] = useState<BreakdownSegment | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Build color map for segments (use external if provided)
  const colorMap = useMemo(() => {
    if (externalColorMap) {
      // Add special colors for non-category segments
      return {
        ...externalColorMap,
        savings: CHART_COLORS.savings,
        uncategorized: CHART_COLORS.uncategorized,
        unallocated: CHART_COLORS.available,
      };
    }

    // Fall back to building our own map
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
  }, [segments, externalColorMap]);

  // Pre-calculate segment boundaries for hover detection
  const segmentBoundaries = useMemo(() => {
    let cumulative = 0;
    return segments.map((segment) => {
      const start = cumulative / total;
      cumulative += segment.amount;
      const end = cumulative / total;
      return { segment, start, end };
    });
  }, [segments, total]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const relativeX = x / rect.width;

      // Find which segment the mouse is over
      const boundary = segmentBoundaries.find(
        (b) => relativeX >= b.start && relativeX < b.end,
      );

      if (boundary) {
        setHoveredSegment(boundary.segment);
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else {
        setHoveredSegment(null);
      }
    },
    [segmentBoundaries],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredSegment(null);
  }, []);

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
      <div
        ref={containerRef}
        className="relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <ResponsiveContainer width="100%" height={40}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide domain={[0, total]} />
            <YAxis type="category" dataKey="name" hide />
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

        {/* Custom Tooltip */}
        {hoveredSegment && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border bg-background p-2 shadow-sm"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y - 60,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="font-medium">{hoveredSegment.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatCents(hoveredSegment.amount)} (
              {((hoveredSegment.amount / total) * 100).toFixed(1)}%)
            </p>
          </div>
        )}
      </div>

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
