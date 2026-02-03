import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { formatCents, formatCentsShort } from '@/lib/utils';

interface WaterfallItem {
  name: string;
  value: number;
  type: 'income' | 'expense' | 'savings' | 'start' | 'end';
}

interface WaterfallChartProps {
  items: WaterfallItem[];
  startValue: number;
  endValue: number;
}

interface ChartDataPoint {
  name: string;
  value: number;
  base: number;
  fill: string;
  type: string;
  displayValue: number;
}

interface TooltipPayload {
  payload: ChartDataPoint;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const isPositive = data.displayValue > 0;
  const isNeutral = data.type === 'start' || data.type === 'end';

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-semibold">{data.name}</p>
      <p
        className={`mt-1 font-mono ${
          isNeutral ? 'text-foreground' : isPositive ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {isNeutral
          ? formatCents(data.displayValue)
          : `${isPositive ? '+' : ''}${formatCents(data.displayValue)}`}
      </p>
    </div>
  );
}

export function WaterfallChart({ items, startValue, endValue }: WaterfallChartProps) {
  const chartData = useMemo(() => {
    const data: ChartDataPoint[] = [];
    let runningTotal = startValue;

    // Start bar
    data.push({
      name: 'Current',
      value: startValue,
      base: 0,
      fill: '#6b7280', // gray
      type: 'start',
      displayValue: startValue,
    });

    // Intermediate bars showing changes
    for (const item of items) {
      if (item.value === 0) continue; // Skip zero changes

      const isPositive = item.value > 0;
      const base = isPositive ? runningTotal : runningTotal + item.value;
      const height = Math.abs(item.value);

      let fill: string;
      if (item.type === 'income') {
        fill = isPositive ? '#22c55e' : '#ef4444'; // green for more, red for less
      } else if (item.type === 'expense') {
        // For expenses: spending less = green (positive surplus impact), more = red
        fill = isPositive ? '#ef4444' : '#22c55e';
      } else if (item.type === 'savings') {
        fill = '#8b5cf6'; // purple for savings changes
      } else {
        fill = '#6b7280';
      }

      data.push({
        name: item.name,
        value: height,
        base,
        fill,
        type: item.type,
        displayValue: item.value,
      });

      runningTotal += item.value;
    }

    // End bar
    data.push({
      name: 'What-If',
      value: endValue,
      base: 0,
      fill: '#8b5cf6', // purple
      type: 'end',
      displayValue: endValue,
    });

    return data;
  }, [items, startValue, endValue]);

  // Calculate domain to include all values
  const maxValue = useMemo(() => {
    let max = Math.max(startValue, endValue);
    let running = startValue;
    for (const item of items) {
      running += item.value;
      max = Math.max(max, running);
    }
    return max * 1.1; // Add 10% padding
  }, [items, startValue, endValue]);

  const minValue = useMemo(() => {
    let min = Math.min(startValue, endValue, 0);
    let running = startValue;
    for (const item of items) {
      running += item.value;
      min = Math.min(min, running);
    }
    return min < 0 ? min * 1.1 : 0;
  }, [items, startValue, endValue]);

  if (items.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No changes to compare.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(value) => formatCentsShort(value)}
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          domain={[minValue, maxValue]}
          width={50}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#e5e7eb" />

        {/* Invisible base bar to position the visible bar */}
        <Bar dataKey="base" stackId="stack" fill="transparent" />

        {/* Visible bar */}
        <Bar dataKey="value" stackId="stack" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
