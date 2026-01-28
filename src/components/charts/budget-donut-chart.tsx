import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import { formatCentsShort } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface BudgetDonutChartProps {
  categoryName: string;
  budgeted: number;
  actual: number;
  forecasted: number;
}

export function BudgetDonutChart({
  categoryName,
  budgeted,
  actual,
  forecasted,
}: BudgetDonutChartProps) {
  // Handle no budget set - show neutral display
  const noBudgetSet = budgeted === 0;

  const remaining = Math.max(0, budgeted - actual - forecasted);
  const isOver = !noBudgetSet && actual > budgeted;
  const willBeOver = !noBudgetSet && actual + forecasted > budgeted;
  const usedPercent = budgeted > 0 ? Math.round((actual / budgeted) * 100) : 0;
  const totalPercent = budgeted > 0 ? Math.round(((actual + forecasted) / budgeted) * 100) : 0;

  // Colours based on whether budget will be exceeded (neutral grey if no budget set)
  const spentColor = noBudgetSet ? '#6b7280' : willBeOver ? '#dc2626' : '#22c55e'; // gray-500, red-600, or green-500
  const forecastColor = noBudgetSet ? '#9ca3af' : willBeOver ? '#fca5a5' : '#86efac'; // gray-400, red-300, or green-300

  let chartData: Array<{ name: string; value: number; color: string }> = [];

  if (noBudgetSet) {
    // No budget: show spending as gray segment, rest as lighter gray
    if (actual > 0 || forecasted > 0) {
      chartData = [
        { name: 'Spent', value: actual, color: spentColor },
        { name: 'Forecast', value: forecasted, color: forecastColor },
      ].filter((d) => d.value > 0);
    } else {
      chartData = [{ name: 'Empty', value: 1, color: '#e5e7eb' }];
    }
  } else {
    chartData = [
      { name: 'Spent', value: Math.min(actual, budgeted), color: spentColor },
      { name: 'Forecast', value: Math.min(forecasted, Math.max(0, budgeted - actual)), color: forecastColor },
      { name: 'Remaining', value: remaining, color: '#e5e7eb' }, // gray-200
    ].filter((d) => d.value > 0);

    // Handle over-budget display - show full red
    if (isOver) {
      chartData.length = 0;
      chartData.push({ name: 'Over', value: 1, color: '#dc2626' });
    }

    // If nothing to show, display empty state
    if (chartData.length === 0) {
      chartData.push({ name: 'Empty', value: 1, color: '#e5e7eb' });
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-28 w-28">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={32}
              outerRadius={48}
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
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) - 6}
                          className="text-xs font-semibold"
                          fill={spentColor}
                        >
                          {formatCentsShort(actual)}
                        </tspan>
                        {forecasted > 0 && (
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 8}
                            className="text-xs"
                            fill={forecastColor}
                          >
                            +{formatCentsShort(forecasted)}
                          </tspan>
                        )}
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {!noBudgetSet && (
          <Badge
            variant={willBeOver ? 'destructive' : 'secondary'}
            className={`absolute -right-1 -top-1 text-[10px] px-1.5 py-0 ${
              !willBeOver ? 'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900/50' : ''
            }`}
          >
            {usedPercent}%{forecasted > 0 && ` → ${totalPercent}%`}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-center text-sm font-medium">{categoryName}</p>
      <p className="text-xs text-muted-foreground">
        {noBudgetSet ? 'No budget set' : `of ${formatCentsShort(budgeted)}`}
      </p>
    </div>
  );
}
