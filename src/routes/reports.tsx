import { useMemo } from 'react';
import { useOutletContext, useSearchParams } from 'react-router';
import { useReportsData } from '@/hooks/use-reports-data';
import { useViewState } from '@/hooks/use-view-state';
import { useDataDateRange } from '@/hooks/use-data-date-range';
import { buildCategoryColorMap } from '@/lib/chart-colors';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DateRangePicker } from '@/components/date-range-picker';
import {
  CategorySpendingChart,
  BudgetComparisonChart,
  CashFlowChart,
  SavingsOverTimeChart,
  SavingsGoalChart,
} from '@/components/charts';

interface OutletContext {
  activeScenarioId: string | null;
}

const VALID_TABS = ['spending', 'budget', 'cashflow', 'savings'] as const;
type TabValue = (typeof VALID_TABS)[number];

export function ReportsPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { startDate, endDate, setDateRange } = useViewState();
  const dataRange = useDataDateRange();

  const currentTab = (searchParams.get('tab') as TabValue) || 'spending';
  const activeTab = VALID_TABS.includes(currentTab) ? currentTab : 'spending';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };
  const {
    monthlySpending,
    monthlyBudgetComparison,
    budgetCategories,
    monthlyNetFlow,
    monthlySavings,
    savingsByGoal,
    usedCategories,
  } = useReportsData(activeScenarioId, startDate, endDate);

  // Build a shared colour map so categories have consistent colours across all charts
  const allCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    usedCategories.forEach((c) => ids.add(c.id));
    budgetCategories.forEach((c) => ids.add(c.id));
    return Array.from(ids);
  }, [usedCategories, budgetCategories]);

  const categoryColorMap = useMemo(
    () => buildCategoryColorMap(allCategoryIds),
    [allCategoryIds],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Insights into your spending patterns</p>
        </div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={setDateRange}
          dataRange={dataRange}
        />
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="spending">Spending</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="savings">Savings</TabsTrigger>
        </TabsList>

        <TabsContent value="spending" className="mt-6">
          <div className="rounded-lg border p-6">
            <h2 className="text-lg font-semibold">Spending by Category</h2>
            <p className="text-sm text-muted-foreground">
              Monthly breakdown of spending by category with forecast totals
            </p>
            <div className="mt-6">
              <CategorySpendingChart
                monthlySpending={monthlySpending}
                usedCategories={usedCategories}
                colorMap={categoryColorMap}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="budget" className="mt-6">
          <div className="rounded-lg border p-6">
            <h2 className="text-lg font-semibold">Spending vs Budget</h2>
            <p className="text-sm text-muted-foreground">
              Spending against budget for the selected period
            </p>
            <div className="mt-6">
              <BudgetComparisonChart
                monthlyBudgetComparison={monthlyBudgetComparison}
                budgetCategories={budgetCategories}
                colorMap={categoryColorMap}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cashflow" className="mt-6">
          <div className="rounded-lg border p-6">
            <h2 className="text-lg font-semibold">Cash Flow</h2>
            <p className="text-sm text-muted-foreground">Monthly income vs expenses</p>
            <div className="mt-6">
              <CashFlowChart monthlyNetFlow={monthlyNetFlow} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="savings" className="mt-6">
          <div className="space-y-8">
            <div className="rounded-lg border p-6">
              <h2 className="text-lg font-semibold">Total Savings Over Time</h2>
              <p className="text-sm text-muted-foreground">Cumulative savings across all goals with projections</p>
              <div className="mt-6">
                <SavingsOverTimeChart monthlySavings={monthlySavings} />
              </div>
            </div>

            {savingsByGoal.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold">By Goal</h2>
                <p className="mb-4 text-sm text-muted-foreground">Progress towards each savings goal</p>
                <div className="grid gap-4 md:grid-cols-2">
                  {savingsByGoal.map((goal) => (
                    <SavingsGoalChart
                      key={goal.goalId}
                      goalName={goal.goalName}
                      targetAmount={goal.targetAmount}
                      monthlySavings={goal.monthlySavings}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
