import { useState, useMemo, useCallback } from 'react';
import { Link, useParams, useOutletContext, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Pencil,
  Archive,
  ArchiveRestore,
  Receipt,
  TrendingUp,
  TrendingDown,
  Target,
  ArrowRight,
  Tag,
  Trash2,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageLoading } from '@/components/page-loading';
import { useCategories } from '@/hooks/use-categories';
import { useTransactions } from '@/hooks/use-transactions';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { useForecasts } from '@/hooks/use-forecasts';
import { CategoryDialog } from '@/components/dialogs/category-dialog';
import { CategoryMonthlyChart } from '@/components/charts/category-monthly-chart';
import { DescriptionBreakdown } from '@/components/description-breakdown';
import { buildMonthlyLimitsByCategory, isRuleActiveBetween } from '@/lib/category-limits';
import { cn, formatCents, formatDate, formatISODate } from '@/lib/utils';
import { useUndoDelete } from '@/hooks/use-undo-delete';
import type { Transaction, Category } from '@/lib/types';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface OutletContext {
  activeScenarioId: string | null;
}

interface BackDestination {
  to: string;
  label: string;
}

const DEFAULT_BACK_DESTINATION: BackDestination = {
  to: '/categories',
  label: 'Back to Categories',
};

/** Pages that link here with ?from=<key>, so Back returns to where the visit started */
const BACK_DESTINATIONS: Record<string, BackDestination> = {
  budget: { to: '/budget', label: 'Back to Budget' },
  'cash-flow': { to: '/cash-flow', label: 'Back to Cash Flow' },
  transactions: { to: '/transactions', label: 'Back to Transactions' },
};

export function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { activeScenarioId } = useOutletContext<OutletContext>();

  // Go back to the page the link was clicked on, named by ?from= on that link.
  // Anything else, including a direct visit, goes to the list of every category.
  const [searchParams] = useSearchParams();
  const { to: backLink, label: backLabel } =
    BACK_DESTINATIONS[searchParams.get('from') ?? ''] ?? DEFAULT_BACK_DESTINATION;

  const navigate = useNavigate();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fixed to current month
  const now = new Date();
  const today = formatISODate(now);
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();

  const periodStart = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const periodEnd = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

  // Calculate last month dates for comparison
  const lastMonthStart = useMemo(
    () => formatISODate(new Date(currentYear, currentMonthIndex - 1, 1)),
    [currentYear, currentMonthIndex],
  );
  const lastMonthEnd = useMemo(
    () => formatISODate(new Date(currentYear, currentMonthIndex, 0)),
    [currentYear, currentMonthIndex],
  );

  // Calculate 12 months ago for chart (11 months back + current = 12 total)
  const chartStart = useMemo(
    () => formatISODate(new Date(currentYear, currentMonthIndex - 11, 1)),
    [currentYear, currentMonthIndex],
  );

  // Period label
  const periodLabel = `${MONTHS[currentMonthIndex]} ${currentYear}`;
  const dayOfMonth = now.getDate();

  // Data hooks - get all transactions then filter
  const {
    categories,
    isLoading: categoriesLoading,
    updateCategory,
    addCategory,
    deleteCategory,
    restoreCategory,
  } = useCategories();
  const { allTransactions, isLoading: transactionsLoading } = useTransactions();
  const {
    budgetRules,
    getRuleForCategory,
    isLoading: budgetLoading,
  } = useBudgetRules(activeScenarioId);
  const { rules: forecastRules, isLoading: forecastsLoading } = useForecasts(activeScenarioId);

  const isLoading = categoriesLoading || transactionsLoading || budgetLoading || forecastsLoading;

  // Find the category
  const category = useMemo(() => categories.find((c) => c.id === id), [categories, id]);

  // Filter transactions to this category (expenses only)
  const allCategoryTransactions = useMemo(
    () => allTransactions.filter((t) => t.categoryId === id && t.type === 'expense'),
    [allTransactions, id],
  );

  // This month's transactions
  const periodTransactions = useMemo(
    () => allCategoryTransactions.filter((t) => t.date >= periodStart && t.date <= periodEnd),
    [allCategoryTransactions, periodStart, periodEnd],
  );

  // Last month's transactions for comparison
  const lastMonthTransactions = useMemo(
    () => allCategoryTransactions.filter((t) => t.date >= lastMonthStart && t.date <= lastMonthEnd),
    [allCategoryTransactions, lastMonthStart, lastMonthEnd],
  );

  // Chart data - last 12 months
  const chartTransactions = useMemo(
    () => allCategoryTransactions.filter((t) => t.date >= chartStart && t.date <= periodEnd),
    [allCategoryTransactions, chartStart, periodEnd],
  );

  // Get allowance info
  // A rule that has ended or not yet started is treated as no allowance, to
  // match the limit below
  const budgetRule = useMemo(() => {
    const ruleForCategory = id ? getRuleForCategory(id) : null;
    if (!ruleForCategory) return null;
    return isRuleActiveBetween(ruleForCategory, periodStart, periodEnd) ? ruleForCategory : null;
  }, [getRuleForCategory, id, periodStart, periodEnd]);

  // This month's limit: the category's bills plus its allowance.
  // Null when it has neither.
  const monthlyLimit = useMemo(() => {
    if (!id) return null;
    const limitsByCategory = buildMonthlyLimitsByCategory(
      budgetRules,
      forecastRules,
      periodStart,
      periodEnd,
    );
    return limitsByCategory[id] ?? null;
  }, [id, budgetRules, forecastRules, periodStart, periodEnd]);

  const monthlyBudget = monthlyLimit ? monthlyLimit.totalCents : null;
  const monthlyFixedExpenses = monthlyLimit?.billsCents ?? 0;

  // Calculate totals
  const thisMonthSpent = useMemo(
    () => periodTransactions.reduce((sum, t) => sum + t.amountCents, 0),
    [periodTransactions],
  );

  const lastMonthSpent = useMemo(
    () => lastMonthTransactions.reduce((sum, t) => sum + t.amountCents, 0),
    [lastMonthTransactions],
  );

  // Calculate monthly spending for chart
  const monthlySpending = useMemo(() => {
    const byMonth: Record<string, number> = {};
    for (const tx of chartTransactions) {
      const month = tx.date.slice(0, 7);
      byMonth[month] = (byMonth[month] ?? 0) + tx.amountCents;
    }

    // Generate all 12 months in range
    const months: { month: string; actual: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentYear, currentMonthIndex - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        month: monthKey,
        actual: byMonth[monthKey] ?? 0,
      });
    }
    return months;
  }, [chartTransactions, currentYear, currentMonthIndex]);

  // Budget calculations
  const budgetUsedPercent =
    monthlyBudget && monthlyBudget > 0 ? Math.round((thisMonthSpent / monthlyBudget) * 100) : null;
  const isOverBudget = budgetUsedPercent !== null && budgetUsedPercent > 100;

  // Expected progress (how much of the month has passed)
  const expectedProgress = Math.round((dayOfMonth / lastDayOfMonth) * 100);

  // vs Last Month calculation
  const vsLastMonth =
    lastMonthSpent > 0
      ? Math.round(((thisMonthSpent - lastMonthSpent) / lastMonthSpent) * 100)
      : thisMonthSpent > 0
        ? 100
        : 0;

  // Recent transactions (last 10 from this month)
  const recentTransactions = useMemo(
    () => [...periodTransactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
    [periodTransactions],
  );

  // Check if category can be deleted (no transactions)
  const canDelete = allCategoryTransactions.length === 0;

  // Handle archive toggle
  const handleArchiveToggle = useCallback(async () => {
    if (category) {
      await updateCategory(category.id, { isArchived: !category.isArchived });
    }
  }, [category, updateCategory]);

  // Undo-wrapped delete
  const undoDelete = useUndoDelete<Category>(deleteCategory, restoreCategory, 'Category');

  const handleDelete = useCallback(async () => {
    if (category) {
      await undoDelete(category, `"${category.name}" deleted`);
      navigate(backLink);
    }
  }, [category, undoDelete, navigate, backLink]);

  // Loading state
  if (isLoading) {
    return (
      <div className="page-shell">
        <PageLoading />
      </div>
    );
  }

  // Category not found
  if (!category) {
    return (
      <div className="page-shell">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to={backLink}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backLabel}
            </Link>
          </Button>
        </div>
        <div className="empty-state">
          <p className="empty-state-text">Category not found.</p>
          <Button asChild className="empty-state-action">
            <Link to="/categories">View all categories</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link to={backLink}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backLabel}
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="page-title-icon bg-slate-500/10">
              <Tag className="h-5 w-5 text-slate-500" />
            </div>
            <h1 className="page-title">{category.name}</h1>
            {category.isArchived && <Badge variant="secondary">Archived</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {budgetRule ? (
              <>
                Allowance: {formatCents(budgetRule.amountCents)}/{budgetRule.cadence}
                {budgetRule.cadence !== 'monthly' && (
                  <span className="text-muted-foreground/60">
                    {' '}
                    ({formatCents(monthlyLimit?.allowanceCents ?? 0)}/mo)
                  </span>
                )}
                {monthlyFixedExpenses > 0 && (
                  <> plus {formatCents(monthlyFixedExpenses)} a month in bills</>
                )}
              </>
            ) : monthlyFixedExpenses > 0 ? (
              <>Bills: {formatCents(monthlyFixedExpenses)}/mo</>
            ) : (
              <Link to="/budget?tab=plan" className="text-primary hover:underline">
                No allowance set – Set one →
              </Link>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleArchiveToggle}>
            {category.isArchived ? (
              <>
                <ArchiveRestore className="mr-2 h-4 w-4" />
                Restore
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </>
            )}
          </Button>
          {canDelete && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete this category</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Current Month Label */}
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{periodLabel}</h2>
        <span className="text-sm text-muted-foreground">
          · Day {dayOfMonth} of {lastDayOfMonth}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* This Month */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
            <Receipt className="h-5 w-5 text-red-500" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Spent</p>
          <p className="mt-1 text-2xl font-semibold">{formatCents(thisMonthSpent)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {periodTransactions.length > 0 ? (
              <a
                href="#recent-transactions"
                className="cursor-pointer hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById('recent-transactions')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {periodTransactions.length} transaction{periodTransactions.length !== 1 ? 's' : ''}
              </a>
            ) : (
              <span>{periodTransactions.length} transactions</span>
            )}
          </p>
        </div>

        {/* vs Budget */}
        <div className="rounded-xl border bg-card p-5">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full',
              monthlyBudget === null
                ? 'bg-slate-500/10'
                : isOverBudget
                  ? 'bg-red-500/10'
                  : 'bg-green-500/10',
            )}
          >
            {monthlyBudget === null ? (
              <Target className="h-5 w-5 text-slate-500" />
            ) : isOverBudget ? (
              <TrendingDown className="h-5 w-5 text-red-500" />
            ) : (
              <Target className="h-5 w-5 text-green-500" />
            )}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">vs Budget</p>
          {monthlyBudget === null ? (
            <>
              <p className="mt-1 text-2xl font-semibold text-muted-foreground">—</p>
              <p className="mt-2 text-sm text-muted-foreground">No budget set</p>
            </>
          ) : (
            <>
              <p
                className={cn(
                  'mt-1 text-2xl font-semibold',
                  isOverBudget ? 'text-red-600' : 'text-foreground',
                )}
              >
                {budgetUsedPercent}%
              </p>
              {/* Progress bar */}
              <div className="mt-3 relative h-2 rounded-full bg-muted">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all',
                    isOverBudget ? 'bg-red-500' : 'bg-green-500',
                  )}
                  style={{ width: `${Math.min(budgetUsedPercent ?? 0, 100)}%` }}
                />
                {/* Expected progress marker */}
                <div
                  className="absolute top-0 h-2 w-0.5 bg-foreground/50"
                  style={{ left: `${expectedProgress}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatCents(thisMonthSpent)} of {formatCents(monthlyBudget)}
                {!isOverBudget && (
                  <span className="text-muted-foreground/70">
                    {' '}
                    · {formatCents(monthlyBudget - thisMonthSpent)} left
                  </span>
                )}
              </p>
            </>
          )}
        </div>

        {/* vs Last Month */}
        <div className="rounded-xl border bg-card p-5">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full',
              vsLastMonth > 0
                ? 'bg-red-500/10'
                : vsLastMonth < 0
                  ? 'bg-green-500/10'
                  : 'bg-slate-500/10',
            )}
          >
            {vsLastMonth > 0 ? (
              <TrendingUp className="h-5 w-5 text-red-500" />
            ) : vsLastMonth < 0 ? (
              <TrendingDown className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingUp className="h-5 w-5 text-slate-500" />
            )}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">vs Last Month</p>
          <p
            className={cn(
              'mt-1 text-2xl font-semibold',
              vsLastMonth > 0
                ? 'text-red-600'
                : vsLastMonth < 0
                  ? 'text-green-600'
                  : 'text-muted-foreground',
            )}
          >
            {vsLastMonth === 0 ? '—' : `${vsLastMonth > 0 ? '+' : ''}${vsLastMonth}%`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {lastMonthSpent === 0 ? (
              'No spending last month'
            ) : (
              <>{formatCents(lastMonthSpent)} last month</>
            )}
          </p>
        </div>
      </div>

      {/* Spending Over Time Chart */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 font-semibold">Monthly Spending</h2>
        <CategoryMonthlyChart
          monthlyData={monthlySpending}
          monthlyBudget={monthlyBudget}
          currentMonth={today.slice(0, 7)}
        />
      </div>

      {/* Two Column Layout: Breakdown + Recent Transactions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Description Breakdown */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 font-semibold">Where It Went</h2>
          <DescriptionBreakdown transactions={periodTransactions} totalSpent={thisMonthSpent} />
        </div>

        {/* Recent Transactions */}
        <div id="recent-transactions" className="rounded-xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent Transactions</h2>
            {periodTransactions.length > 10 && (
              <Link
                to={`/transactions?category=${id}`}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View all
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions this month.</p>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category Edit Dialog */}
      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={category}
        addCategory={addCategory}
        updateCategory={updateCategory}
      />
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{transaction.description}</p>
        <p className="text-muted-foreground">{formatDate(transaction.date)}</p>
      </div>
      <p className="ml-4 font-mono text-muted-foreground">{formatCents(transaction.amountCents)}</p>
    </div>
  );
}
