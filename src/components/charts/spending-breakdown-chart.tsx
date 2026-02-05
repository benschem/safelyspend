import { useMemo, useState, useCallback, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
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
  /** When true, legend items are not clickable (except those in toggleableIds) */
  disableToggle?: boolean;
  /** Array of segment IDs that can still be toggled when disableToggle is true */
  toggleableIds?: string[];
  /** When set, shows a dashed vertical line at this percentage (0-100) to indicate income mark */
  incomeMarker?: number;
  /** Array of segment IDs that should show dollar amounts instead of percentages in legend */
  showDollarAmountIds?: string[];
  /** Optional deltas for each segment (in cents) to show comparison with default scenario */
  segmentDeltas?: Record<string, number> | undefined;
}

export function SpendingBreakdownChart({
  segments,
  total,
  colorMap: externalColorMap,
  hiddenSegmentIds,
  onSegmentToggle,
  disableToggle = false,
  toggleableIds = [],
  incomeMarker,
  showDollarAmountIds = [],
  segmentDeltas,
}: SpendingBreakdownChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredSegment, setHoveredSegment] = useState<BreakdownSegment | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [internalHiddenSegments, setInternalHiddenSegments] = useState<Set<string>>(new Set());

  // Use controlled state if provided, otherwise use internal state
  const hiddenSegments = hiddenSegmentIds ?? internalHiddenSegments;

  const toggleSegment = useCallback(
    (id: string) => {
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
    },
    [onSegmentToggle],
  );

  // Calculate total of visible segments (for scaling)
  const visibleTotal = useMemo(() => {
    return segments.filter((s) => !hiddenSegments.has(s.id)).reduce((sum, s) => sum + s.amount, 0);
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
      const boundary = segmentBoundaries.find((b) => relativeX >= b.start && relativeX < b.end);

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

  // Check if all segments are hidden
  // Check if all segments are hidden (must check actual IDs, not just count)
  const allHidden = segments.length > 0 && segments.every((s) => hiddenSegments.has(s.id));

  if (total === 0 || segments.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {allHidden ? (
        <div className="flex h-10 items-center justify-center text-sm text-muted-foreground">
          All categories hidden. Click a category to show it.
        </div>
      ) : (
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

          {/* Income Marker Line (for over-budget indication) */}
          {incomeMarker !== undefined && incomeMarker < 100 && (
            <>
              <div
                className="pointer-events-none absolute w-0.5 bg-red-500"
                style={{
                  left: `${incomeMarker}%`,
                  top: '-20px',
                  height: 'calc(100% + 20px)',
                  transform: 'translateX(-50%)',
                }}
              />
              <span
                className="pointer-events-none absolute whitespace-nowrap rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{
                  left: `${incomeMarker}%`,
                  top: '-20px',
                  transform: 'translateX(calc(-100% - 4px))',
                }}
              >
                Expected income
              </span>
            </>
          )}

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
      )}

      {/* Interactive Legend */}
      <div className="mt-3 flex flex-wrap gap-2">
        {segments.filter((s) => s.amount > 0).map((segment) => {
          const percentage = ((segment.amount / total) * 100).toFixed(0);
          const isHidden = hiddenSegments.has(segment.id);
          const canToggle = !disableToggle || toggleableIds.includes(segment.id);
          const showDollar = showDollarAmountIds.includes(segment.id);
          const displayValue = showDollar ? formatCents(segment.amount) : `${percentage}%`;
          const delta = segmentDeltas?.[segment.id];
          const hasDelta = delta !== undefined && delta !== 0;
          return canToggle ? (
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
                {segment.name} ({displayValue})
                {hasDelta && (
                  <span className="ml-1 text-violet-600 dark:text-violet-400">
                    {delta > 0 ? '+' : ''}{formatCents(delta)}
                  </span>
                )}
              </span>
            </button>
          ) : (
            <div
              key={segment.id}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
            >
              <div
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: colorMap[segment.id] ?? CHART_COLORS.uncategorized }}
              />
              <span>
                {segment.name} ({displayValue})
                {hasDelta && (
                  <span className="ml-1 text-violet-600 dark:text-violet-400">
                    {delta > 0 ? '+' : ''}{formatCents(delta)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
