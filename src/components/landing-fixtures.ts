/**
 * Static data for the landing page, shaped exactly as the real chart components
 * expect it, so the page renders the app's own UI rather than a drawing of it.
 *
 * Every figure derives from one budget, so the hero, the four totals, the
 * breakdown bar, the spending cards and the charts all reconcile. The budget is
 * built on Australian medians for 2026:
 *
 *   Income    $5,900/mo take-home, from the ABS median full-time wage of about
 *             $1,741/week gross ($90.5k/yr, roughly $70.8k after tax and Medicare),
 *             paid fortnightly at $2,723.
 *   Rent      $1,820/mo, near $420/week. Below the $724/week capital-city median,
 *             which is a whole-household figure.
 *   Groceries $650/mo, against the ABS household average of $178/week.
 *   Power     $110/mo, billed quarterly, from an average annual bill near $1,300.
 *   Car       $130/mo insurance, from an average comprehensive premium of $1,560.
 *   Savings   $500/mo, a little over the 6.5% national household saving ratio.
 *
 * All three charts project from the real current date, so everything here is built
 * relative to today. Pinning these to fixed dates would make the page drift into
 * nonsense: a goal that quietly goes overdue, a burn rate chart for a month that
 * finished long ago.
 */

// --- The budget everything else derives from (monthly, in cents) ---

export const MONTHLY_INCOME = 590000;
export const MONTHLY_FIXED = 247000;
export const MONTHLY_BUDGETED = 173000;
export const MONTHLY_SAVINGS = 50000;
export const MONTHLY_SURPLUS = MONTHLY_INCOME - MONTHLY_FIXED - MONTHLY_BUDGETED - MONTHLY_SAVINGS;

/** Take-home per fortnight, which is what actually lands in the account. */
const FORTNIGHTLY_PAY = 272300;

const now = new Date();

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 'YYYY-MM' for a month offset from the current one. */
function monthKey(offset: number): string {
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** 'YYYY-MM-DD' for a day in the current month. */
function dayInThisMonth(day: number): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(day)}`;
}

function shareOfIncome(amountCents: number): string {
  return `${Math.round((amountCents / MONTHLY_INCOME) * 100)}% of income`;
}

const daysInThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
const todayDay = now.getDate();

// --- Hero: the budget page's headline figure ---

export const BUDGET_STATUS = {
  scenarioName: 'Current Plan',
  status: 'surplus' as const,
  amountCents: MONTHLY_SURPLUS,
  periodLabel: 'per month',
  differsFromPlan: false,
  delta: 0,
  showDelta: false,
  comparedToName: 'Current Plan',
};

// --- The four totals ---

export const BUDGET_TOTALS = [
  {
    label: 'Income',
    tone: 'income' as const,
    amountCents: MONTHLY_INCOME,
    subtitle: '1 source',
  },
  {
    label: 'Fixed Expenses',
    tone: 'expense' as const,
    amountCents: MONTHLY_FIXED,
    subtitle: shareOfIncome(MONTHLY_FIXED),
  },
  {
    label: 'Budgeted Expenses',
    tone: 'expense' as const,
    amountCents: MONTHLY_BUDGETED,
    subtitle: shareOfIncome(MONTHLY_BUDGETED),
  },
  {
    label: 'Savings',
    tone: 'savings' as const,
    amountCents: MONTHLY_SAVINGS,
    subtitle: shareOfIncome(MONTHLY_SAVINGS),
  },
];

/** The same totals as a share of income, for the app's own breakdown bar. */
export const INCOME_BREAKDOWN = {
  segments: [
    { id: 'fixed', name: 'Fixed Expenses', amount: MONTHLY_FIXED },
    { id: 'savings', name: 'Savings', amount: MONTHLY_SAVINGS },
    { id: 'variable', name: 'Budgeted Expenses', amount: MONTHLY_BUDGETED },
    { id: 'surplus', name: 'Surplus', amount: MONTHLY_SURPLUS },
  ],
  total: MONTHLY_INCOME,
  colorMap: {
    fixed: '#b91c1c',
    variable: '#ef4444',
    savings: '#3b82f6',
    surplus: '#22c55e',
  },
};

// --- The check-in ---

export const CHECK_IN = {
  cashBalanceCents: 318000,
  totalSavingsCents: 1355000,
  endOfMonthCents: MONTHLY_SURPLUS,
  budgetsOnTrack: '3 of 4 on track',
};

// --- Spending against budget, roughly two weeks in ---

export const CATEGORY_SPEND = [
  { label: 'Groceries', spent: 41200, budget: 65000 },
  { label: 'Transport', spent: 19000, budget: 28000 },
  { label: 'Dining Out', spent: 39100, budget: 35000 },
  { label: 'Entertainment', spent: 4500, budget: 15000 },
];

// --- Burn rate ---

/** Steady daily spend with heavier weekends, up to today. */
function spendingSoFar(): { date: string; amount: number }[] {
  const days: { date: string; amount: number }[] = [];
  for (let day = 1; day <= todayDay; day++) {
    const weekday = new Date(now.getFullYear(), now.getMonth(), day).getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    days.push({ date: dayInThisMonth(day), amount: isWeekend ? 9500 : 4800 });
  }
  return days;
}

export const SPENDING_PACE = {
  showDeltas: false,
  pacesDiffer: true,
  projectedVariable: 165000,
  variable: MONTHLY_BUDGETED,
  dailySpending: spendingSoFar(),
  totalBudget: MONTHLY_FIXED + MONTHLY_BUDGETED,
  periodStart: dayInThisMonth(1),
  periodEnd: dayInThisMonth(daysInThisMonth),
  periodLabel: 'This month',
  viewMode: 'month' as const,
  income: MONTHLY_INCOME,
  fixedExpenseSchedule: [
    { date: dayInThisMonth(1), amount: 182000 },
    { date: dayInThisMonth(Math.min(20, daysInThisMonth)), amount: 32500 },
  ],
  variableBudget: MONTHLY_BUDGETED,
  fixedExpensesTotal: MONTHLY_FIXED,
};

// --- Savings goal ---

/**
 * Contributions towards the Japan trip. The card averages `actual + forecast`
 * across the series to get a monthly rate, so only `actual` carries a figure.
 */
function japanTripMonthlySavings() {
  let cumulative = 235000;
  return [-5, -4, -3, -2, -1, 0].map((offset) => {
    cumulative += MONTHLY_SAVINGS;
    return {
      month: monthKey(offset),
      actual: MONTHLY_SAVINGS,
      forecast: 0,
      cumulativeActual: cumulative,
      cumulativeForecast: cumulative,
    };
  });
}

const deadline = new Date(now.getFullYear(), now.getMonth() + 8, 1);

export const SAVINGS_GOAL = {
  goalName: 'Japan Trip',
  targetAmount: 800000,
  currentBalance: 485000,
  deadline: `${deadline.getFullYear()}-${pad(deadline.getMonth() + 1)}-01`,
  annualInterestRate: 4.5,
  monthlySavings: japanTripMonthlySavings(),
};

// --- Trends ---

/**
 * Six months of earned, spent and saved, ending this month. Fortnightly pay means
 * most months carry two pay days and one in six carries three, which is the spike.
 *
 * The chart adds `actual` and `forecast` together rather than choosing between
 * them, because the app only ever populates one: actual for months that have
 * happened, forecast for months still ahead. These are all past months, so the
 * forecast side stays at zero.
 */
export const MONTHLY_NET_FLOW = [
  { pays: 2, expenses: 418000 },
  { pays: 2, expenses: 441000 },
  { pays: 3, expenses: 425000 },
  { pays: 2, expenses: 462000 },
  { pays: 2, expenses: 409000 },
  { pays: 2, expenses: 398000 },
].map(({ pays, expenses }, index) => {
  const income = FORTNIGHTLY_PAY * pays;
  return {
    month: monthKey(index - 5),
    income: { actual: income, forecast: 0 },
    expenses: { actual: expenses, forecast: 0 },
    savings: { actual: MONTHLY_SAVINGS, forecast: 0 },
    interest: 0,
    net: { actual: income - expenses - MONTHLY_SAVINGS, forecast: 0 },
  };
});
