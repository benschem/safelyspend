import { useMemo, useState, useEffect } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { ChartSpline } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useReportsData } from '@/hooks/use-reports-data';
import { useViewState } from '@/hooks/use-view-state';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { useTransactions } from '@/hooks/use-transactions';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { buildCategoryColorMap } from '@/lib/chart-colors';
import { formatCompactDate, TIMELINE_UNIT_BOUNDS } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  BudgetComparisonChart,
  CashFlowChart,
  SavingsOverTimeChart,
} from '@/components/charts';
import { ScenarioSelector } from '@/components/scenario-selector';
import type { TimelineMode, TimelineUnit } from '@/lib/types';

interface OutletContext {
  activeScenarioId: string | null;
}

const VALID_TABS = ['cashflow', 'spending', 'savings'] as const;
type TabValue = (typeof VALID_TABS)[number];
const STORAGE_KEY = 'budget:reportsTab';
const SAVINGS_VIEW_KEY = 'budget:savingsChartView';

const MODES: { value: TimelineMode; label: string }[] = [
  { value: 'past', label: 'Past' },
  { value: 'around-present', label: 'Present' },
  { value: 'future', label: 'Future' },
];

const UNITS: { value: TimelineUnit; label: string; pluralLabel: string }[] = [
  { value: 'months', label: 'month', pluralLabel: 'months' },
  { value: 'years', label: 'year', pluralLabel: 'years' },
];

function formatTimelineDescription(amount: number, unit: TimelineUnit, mode: TimelineMode): string {
  const unitLabel = amount === 1
    ? UNITS.find((u) => u.value === unit)?.label
    : UNITS.find((u) => u.value === unit)?.pluralLabel;

  switch (mode) {
    case 'past':
      return `Past ${amount} ${unitLabel}`;
    case 'around-present': {
      // "6 months around" = ±3 months each side
      const totalMonths = unit === 'years' ? amount * 12 : amount;
      const half = Math.floor(totalMonths / 2);
      const halfUnit = half === 1 ? 'month' : 'months';
      return `±${half} ${halfUnit} from now`;
    }
    case 'future':
      return `Next ${amount} ${unitLabel}`;
    case 'custom':
      return 'Custom range';
  }
}

export function InsightsPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    mode,
    amount,
    unit,
    lastPresetMode,
    startDate,
    endDate,
    setMode,
    setAmount,
    setUnit,
    setCustomDateRange,
  } = useViewState();

  // Popover state for date range picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);
  const [customFocused, setCustomFocused] = useState(false);

  const isCustomMode = mode === 'custom';
  const isCustomActive = isCustomMode || customFocused;
  const bounds = TIMELINE_UNIT_BOUNDS[unit];

  // Show computed dates when not actively editing custom range
  const displayStartDate = isCustomActive ? tempStartDate : startDate;
  const displayEndDate = isCustomActive ? tempEndDate : endDate;

  // Format description for hero
  const modeDescription = isCustomMode
    ? 'Custom range'
    : formatTimelineDescription(amount, unit, mode);

  const handlePickerOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setTempStartDate(startDate);
      setTempEndDate(endDate);
    } else {
      setCustomFocused(false);
    }
    setPickerOpen(newOpen);
  };

  const handleStartDateChange = (value: string) => {
    setTempStartDate(value);
    setCustomFocused(true);
    if (value && tempEndDate && value <= tempEndDate) {
      setCustomDateRange(value, tempEndDate);
    }
  };

  const handleEndDateChange = (value: string) => {
    setTempEndDate(value);
    setCustomFocused(true);
    if (tempStartDate && value && tempStartDate <= value) {
      setCustomDateRange(tempStartDate, value);
    }
  };

  const handleAmountChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= bounds.min && num <= bounds.max) {
      setCustomFocused(false);
      setAmount(num);
    }
  };

  const handleUnitChange = (newUnit: TimelineUnit) => {
    setCustomFocused(false);
    setUnit(newUnit);
  };

  const handleModeClick = (newMode: TimelineMode) => {
    if (newMode !== 'custom') {
      setCustomFocused(false);
      setMode(newMode);
    }
  };

  // Generate amount options based on current unit bounds
  const amountOptions = [];
  for (let i = bounds.min; i <= bounds.max; i++) {
    amountOptions.push(i);
  }

  // Tab state: localStorage persists selection, URL param overrides for direct links
  const [activeTab, setActiveTab] = useState<TabValue>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as TabValue | null;
    if (stored && VALID_TABS.includes(stored)) return stored;
    return 'cashflow';
  });

  // Handle URL param override (for direct links from dashboard)
  const urlTab = searchParams.get('tab') as TabValue | null;
  useEffect(() => {
    if (urlTab && VALID_TABS.includes(urlTab)) {
      setActiveTab(urlTab);
      localStorage.setItem(STORAGE_KEY, urlTab);
    }
  }, [urlTab]);

  const handleTabChange = (value: string) => {
    const tab = value as TabValue;
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
    setSearchParams({ tab }, { replace: true });
  };

  // Savings chart view state: 'total', 'dedicated', or a specific goal ID
  const [savingsView, setSavingsView] = useState<string>(() => {
    return localStorage.getItem(SAVINGS_VIEW_KEY) ?? 'total';
  });

  const handleSavingsViewChange = (value: string) => {
    setSavingsView(value);
    localStorage.setItem(SAVINGS_VIEW_KEY, value);
  };

  // Get emergency fund info for dedicated savings calculation
  const { emergencyFund } = useSavingsGoals();

  const {
    isLoading,
    monthlyBudgetComparison,
    budgetCategories,
    monthlyNetFlow,
    monthlySavings,
    savingsByGoal,
  } = useReportsData(activeScenarioId, startDate, endDate);

  // Validate savingsView - must be 'total', 'dedicated', or a valid goal ID
  const validGoalIds = useMemo(() => savingsByGoal.map((g) => g.goalId), [savingsByGoal]);
  const effectiveSavingsView = useMemo(() => {
    if (savingsView === 'total' || savingsView === 'dedicated') return savingsView;
    if (validGoalIds.includes(savingsView)) return savingsView;
    return 'total'; // Default to total if invalid
  }, [savingsView, validGoalIds]);

  // Update localStorage if we had to correct an invalid value
  useEffect(() => {
    if (effectiveSavingsView !== savingsView) {
      localStorage.setItem(SAVINGS_VIEW_KEY, effectiveSavingsView);
    }
  }, [effectiveSavingsView, savingsView]);

  // Calculate dedicated savings (total minus emergency fund)
  const dedicatedSavings = useMemo(() => {
    if (!emergencyFund) return monthlySavings; // No emergency fund, dedicated = total

    const emergencyGoalData = savingsByGoal.find((g) => g.goalId === emergencyFund.id);
    if (!emergencyGoalData) return monthlySavings;

    // Subtract emergency fund from total for each month
    return monthlySavings.map((month, i) => {
      const emergencyMonth = emergencyGoalData.monthlySavings[i];
      return {
        ...month,
        actual: month.actual - (emergencyMonth?.actual ?? 0),
        forecast: month.forecast - (emergencyMonth?.forecast ?? 0),
        cumulativeActual: month.cumulativeActual - (emergencyMonth?.cumulativeActual ?? 0),
        cumulativeForecast: month.cumulativeForecast - (emergencyMonth?.cumulativeForecast ?? 0),
      };
    });
  }, [monthlySavings, savingsByGoal, emergencyFund]);

  // Build a shared colour map so categories have consistent colours across all charts
  const allCategoryIds = useMemo(() => {
    return budgetCategories.map((c) => c.id);
  }, [budgetCategories]);

  const categoryColorMap = useMemo(
    () => buildCategoryColorMap(allCategoryIds),
    [allCategoryIds],
  );

  // Determine if viewing past period
  const today = new Date().toISOString().slice(0, 10);
  const isPastOnly = endDate <= today;

  // Calculate starting balance for cash flow chart
  const { getActiveAnchor, anchors } = useBalanceAnchors();
  const { allTransactions } = useTransactions();

  const balanceInfo = useMemo(() => {
    // Get anchor that applies at the start of the report period
    const anchorBeforeStart = getActiveAnchor(startDate);

    // Find first anchor within the date range (if any)
    const anchorInRange = anchors
      .filter((a) => a.date >= startDate && a.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    if (anchorBeforeStart) {
      // We have an anchor before the start - calculate balance from period start
      const transactionsBeforePeriod = allTransactions.filter(
        (t) => t.date >= anchorBeforeStart.date && t.date < startDate,
      );

      let balance = anchorBeforeStart.balanceCents;
      for (const t of transactionsBeforePeriod) {
        if (t.type === 'income' || t.type === 'adjustment') {
          balance += t.amountCents;
        } else {
          balance -= t.amountCents;
        }
      }

      return {
        startingBalance: balance,
        balanceStartMonth: null, // Start from beginning
        warning: null,
      };
    }

    if (anchorInRange) {
      // No anchor before start, but there's one in the range
      // Start balance from that anchor's month
      const anchorMonth = anchorInRange.date.slice(0, 7);

      return {
        startingBalance: anchorInRange.balanceCents,
        balanceStartMonth: anchorMonth,
        warning: {
          title: `Cash shown only from ${formatCompactDate(anchorInRange.date, true)}`,
          linkText: 'Add an earlier initial cash amount',
          linkSuffix: 'to see cash from the start of this period.',
        },
      };
    }

    // No anchors at all for this period
    return {
      startingBalance: null,
      balanceStartMonth: null,
      warning: {
        title: 'No initial cash set for this period',
        linkText: 'Add a initial cash amount',
        linkSuffix: 'to see your cash over time.',
      },
    };
  }, [getActiveAnchor, anchors, allTransactions, startDate, endDate]);

  return (
    <div className="page-shell space-y-6">
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">
          <div className="page-title-icon bg-slate-500/10">
            <ChartSpline className="h-5 w-5 text-slate-500" />
          </div>
          Insights
        </h1>
        <p className="page-description">Understand your financial patterns</p>
      </div>

      {/* Hero Header - Date Range Selector */}
      <div className="mb-4 min-h-28 text-center sm:min-h-32">
        {/* Hint text - click to change */}
        <p className="flex min-h-8 items-center justify-center text-xs text-muted-foreground">
          Click to change
        </p>

        {/* Natural language description - clickable to open picker */}
        <Popover open={pickerOpen} onOpenChange={handlePickerOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="cursor-pointer text-2xl font-bold tracking-tight hover:bg-transparent hover:text-foreground/80 sm:text-3xl"
            >
              {modeDescription}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-fit min-w-72" align="center">
            <div className="space-y-4">
              {/* Preset controls */}
              <div className={cn('flex items-center gap-2', isCustomActive && 'opacity-50')}>
                <Select value={isCustomActive ? '' : amount.toString()} onValueChange={handleAmountChange}>
                  <SelectTrigger className="w-16 cursor-pointer">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {amountOptions.map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={isCustomActive ? '' : unit}
                  onValueChange={(v) => handleUnitChange(v as TimelineUnit)}
                >
                  <SelectTrigger className="w-24 cursor-pointer">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {amount === 1 ? u.label : u.pluralLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Direction Toggle */}
                <div className="inline-flex h-9 flex-1 rounded-md border border-input bg-background p-1 shadow-sm">
                  {MODES.map((m) => {
                    const isSelected = isCustomActive
                      ? m.value === lastPresetMode
                      : m.value === mode;
                    return (
                      <button
                        key={m.value}
                        onClick={() => handleModeClick(m.value)}
                        className={cn(
                          'flex flex-1 cursor-pointer items-center justify-center rounded-sm px-2 text-sm font-medium transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          isSelected
                            ? isCustomActive
                              ? 'bg-primary/50 text-primary-foreground/70 shadow-sm'
                              : 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        )}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date inputs - always visible, synced with current range */}
              <div className={cn('grid grid-cols-2 gap-2', !isCustomActive && 'opacity-50')}>
                <div className="grid gap-1">
                  <Label htmlFor="timeline-range-start" className="text-xs text-muted-foreground">
                    Start
                  </Label>
                  <Input
                    id="timeline-range-start"
                    type="date"
                    value={displayStartDate}
                    max={displayEndDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    onFocus={() => {
                      setTempStartDate(startDate);
                      setTempEndDate(endDate);
                      setCustomFocused(true);
                    }}
                    className="h-8 cursor-pointer"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="timeline-range-end" className="text-xs text-muted-foreground">
                    End
                  </Label>
                  <Input
                    id="timeline-range-end"
                    type="date"
                    value={displayEndDate}
                    min={displayStartDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    onFocus={() => {
                      setTempStartDate(startDate);
                      setTempEndDate(endDate);
                      setCustomFocused(true);
                    }}
                    className="h-8 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Actual date range */}
        <p className="mt-2 text-sm text-muted-foreground">
          {formatCompactDate(startDate, true)} — {formatCompactDate(endDate, true)}
        </p>
      </div>

      {/* Controls row: Tabs left, Scenario right */}
      <div className="flex items-center justify-between">
        {/* Tabs */}
        <div className="inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground">
          {[
            { value: 'cashflow', label: 'Cash Flow' },
            { value: 'spending', label: 'Spending' },
            { value: 'savings', label: 'Savings' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTabChange(tab.value)}
              className={cn(
                'inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all',
                activeTab === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scenario selector */}
        <ScenarioSelector />
      </div>

      {/* Content sections */}
      {isLoading ? (
        <PageLoading />
      ) : activeTab === 'spending' ? (
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex min-h-9 items-center">
            <p className="text-sm text-muted-foreground">
              {isPastOnly
                ? 'How your spending compared to your budget'
                : 'Actual and forecast spending vs budget'}
            </p>
          </div>
          <BudgetComparisonChart
            monthlyBudgetComparison={monthlyBudgetComparison}
            budgetCategories={budgetCategories}
            colorMap={categoryColorMap}
          />
        </div>
      ) : activeTab === 'cashflow' ? (
        <div className="space-y-6">
          {balanceInfo.warning && (
            <Alert variant="warning">
              <AlertTitle>{balanceInfo.warning.title}</AlertTitle>
              <AlertDescription>
                <Link to="/settings" className="underline">
                  {balanceInfo.warning.linkText}
                </Link>{' '}
                {balanceInfo.warning.linkSuffix}
              </AlertDescription>
            </Alert>
          )}
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-4 flex min-h-9 items-center">
              <p className="text-sm text-muted-foreground">
                {isPastOnly
                  ? 'Your cash and monthly income vs expenses'
                  : 'Cash and savings over time, including planned income, spending and saving'}
              </p>
            </div>
            <CashFlowChart
              monthlyNetFlow={monthlyNetFlow}
              startingBalance={balanceInfo.startingBalance}
              balanceStartMonth={balanceInfo.balanceStartMonth}
            />
          </div>
        </div>
      ) : activeTab === 'savings' ? (
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex min-h-9 items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {isPastOnly
                ? 'Cumulative savings contributions'
                : 'Saved so far, plus planned contributions'}
            </p>
            {savingsByGoal.length > 0 && (
              <Select value={effectiveSavingsView} onValueChange={handleSavingsViewChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Total Savings</SelectItem>
                  {emergencyFund && (
                    <SelectItem value="dedicated">Dedicated Savings</SelectItem>
                  )}
                  {savingsByGoal.map((goal) => (
                    <SelectItem key={goal.goalId} value={goal.goalId}>
                      {goal.goalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {effectiveSavingsView === 'total' ? (
            <SavingsOverTimeChart monthlySavings={monthlySavings} />
          ) : effectiveSavingsView === 'dedicated' ? (
            <SavingsOverTimeChart monthlySavings={dedicatedSavings} />
          ) : (
            <SavingsOverTimeChart
              monthlySavings={
                savingsByGoal.find((g) => g.goalId === effectiveSavingsView)?.monthlySavings ?? []
              }
              deadline={savingsByGoal.find((g) => g.goalId === effectiveSavingsView)?.deadline}
              targetAmount={savingsByGoal.find((g) => g.goalId === effectiveSavingsView)?.targetAmount}
              startingBalance={savingsByGoal.find((g) => g.goalId === effectiveSavingsView)?.startingBalance}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
