import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import { Link } from 'react-router';
import { formatCents } from '@/lib/utils';

interface SavingsDonutChartProps {
  goalId: string;
  goalName: string;
  targetAmount: number;
  savedAmount: number;
  forecastedAmount: number;
}

export function SavingsDonutChart({
  goalId,
  goalName,
  targetAmount,
  savedAmount,
  forecastedAmount,
}: SavingsDonutChartProps) {
  const remaining = Math.max(0, targetAmount - savedAmount - forecastedAmount);
  const actualPercent = targetAmount > 0 ? Math.round((savedAmount / targetAmount) * 100) : 0;

  const chartData = [
    { name: 'Saved', value: savedAmount, color: '#2563eb' }, // blue-600
    { name: 'Forecast', value: forecastedAmount, color: '#93c5fd' }, // blue-300
    { name: 'Remaining', value: remaining, color: '#e5e7eb' }, // gray-200
  ].filter((d) => d.value > 0);

  // If nothing to show, display empty state
  if (chartData.length === 0 || targetAmount === 0) {
    chartData.push({ name: 'Remaining', value: 1, color: '#e5e7eb' });
  }

  return (
    <div className="flex flex-col items-center">
      <div className="h-24 w-24">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={42}
              paddingAngle={1}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-lg font-bold"
                        >
                          {actualPercent}%
                        </tspan>
                      </text>
                    );
                  }
                  return null;
                }}
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <Link
        to={`/savings/${goalId}`}
        className="mt-2 text-center text-sm font-medium hover:underline"
      >
        {goalName}
      </Link>
      <p className="text-xs text-muted-foreground">
        {formatCents(savedAmount)} / {formatCents(targetAmount)}
      </p>
    </div>
  );
}
