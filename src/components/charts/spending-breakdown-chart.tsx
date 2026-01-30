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
  hiddenSegmentIds?: Set<string>;
  onSegmentToggle?: (id: string) => void;
}

export function SpendingBreakdownChart({
  segments,
  total,
  colorMap: externalColorMap,
  hiddenSegmentIds,
  onSegmentToggle,
}: SpendingBreakdownChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredSegment, setHoveredSegment] = useState<BreakdownSegment | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [internalHiddenSegments, setInternalHiddenSegments] = useState<Set<string>>(new Set());

  // Use controlled state if provided, otherwise use internal state
  const hiddenSegments = hiddenSegmentIds ?? internalHiddenSegments;

  const toggleSegment = useCallback((id: string) => {
    if (onSegmentToggle) {
      onSegmentToggle(id);
    } else {
      setInternalHiddenSegments((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    }
  }, [onSegmentToggle]);

  // Calculate total of visible segments (for scaling)
  const visibleTotal = useMemo(() => {
    return segments
      .filter((s) => !hiddenSegments.has(s.id))
      .reduce((sum, s) => sum + s.amount, 0);
  }, [segments, hiddenSegments]);

  // Build colour map for segments (use external if provided)
  const colorMap = useMemo(() => {
    if (externalColorMap) {
      // Add special colours for non-category segments
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

  // Pre-calculate segment boundaries for hover detection (only visible segments)
  const segmentBoundaries = useMemo(() => {
    let cumulative = 0;
    return segments
      .filter((s) => !hiddenSegments.has(s.id))
      .map((segment) => {
        const start = visibleTotal > 0 ? cumulative / visibleTotal : 0;
        cumulative += segment.amount;
        const end = visibleTotal > 0 ? cumulative / visibleTotal : 0;
        return { segment, start, end };
      });
  }, [segments, hiddenSegments, visibleTotal]);

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

  // Transform data for horizontal stacked bar (all segments, hidden ones have 0 value)
  const chartData = useMemo(() => {
    const dataPoint: Record<string, number | string> = { name: 'Spending' };
    for (const segment of segments) {
      dataPoint[segment.id] = hiddenSegments.has(segment.id) ? 0 : segment.amount;
    }
    return [dataPoint];
  }, [segments, hiddenSegments]);

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
            <XAxis type="number" hide domain={[0, visibleTotal]} />
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

      {/* Interactive Legend */}
      <div className="mt-3 flex flex-wrap gap-2">
        {segments.map((segment) => {
          const percentage = ((segment.amount / total) * 100).toFixed(0);
          const isHidden = hiddenSegments.has(segment.id);
          return (
            <button
              key={segment.id}
              type="button"
              onClick={() => toggleSegment(segment.id)}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all hover:bg-muted ${
                isHidden ? 'opacity-40' : ''
              }`}
            >
              <div
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: colorMap[segment.id] ?? CHART_COLORS.uncategorized }}
              />
              <span className={isHidden ? 'line-through' : ''}>
                {segment.name} ({percentage}%)
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
