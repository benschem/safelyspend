import { useEffect } from 'react';
import { Link } from 'react-router';
import { trackLandingPageview } from '@/lib/analytics';
import { useAuth } from '@/hooks/use-auth';
import { useAppConfig } from '@/hooks/use-app-config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  ArrowLeftRight,
  BanknoteArrowDown,
  BanknoteArrowUp,
  Briefcase,
  Building2,
  CircleCheck,
  CloudOff,
  Download,
  FileSpreadsheet,
  Gift,
  GraduationCap,
  Package,
  PiggyBank,
  TrendingUp,
} from 'lucide-react';
import { formatCents } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { PersonaId } from '@/lib/demo-personas';
import { BudgetStatusHero } from '@/components/budget/status-hero';
import { BudgetSummaryCard } from '@/components/budget/summary-card';
import { CategoryProgressBar } from '@/components/cash-flow/category-progress-bar';
import { getCategoryColor } from '@/lib/chart-colors';
import {
  CashFlowChart,
  SavingsGoalProgressCard,
  SpendingBreakdownChart,
} from '@/components/charts';
import { SpendingPaceCard } from '@/components/cash-flow/spending-pace-card';
import {
  SPENDING_PACE,
  SAVINGS_GOAL,
  MONTHLY_NET_FLOW,
  BUDGET_STATUS,
  BUDGET_TOTALS,
  INCOME_BREAKDOWN,
  CATEGORY_SPEND,
  CHECK_IN,
  MONTHLY_INCOME,
} from '@/components/landing-fixtures';

interface LandingPageProps {
  onViewDemo: (personaId?: PersonaId) => void;
}

/**
 * Landing page copy for each demo persona. The blurbs are marketing voice, so they
 * live here rather than in the persona configs, but `id` is typed against the real
 * personas: rename or remove one and this stops compiling.
 */
const PERSONAS: ReadonlyArray<{
  id: PersonaId;
  name: string;
  tagline: string;
  icon: LucideIcon;
  description: string;
}> = [
  {
    id: 'professional-paul',
    name: 'Paul',
    tagline: 'Marketing manager',
    icon: Briefcase,
    description:
      'Comfortable and organised. Fortnightly pay, saving for a Japan trip and a house deposit. Occasionally splurges on nice dinners.',
  },
  {
    id: 'student-soo-jin',
    name: 'Soo-Jin',
    tagline: 'Uni student',
    icon: GraduationCap,
    description:
      'Tight budget but disciplined. Works part-time at a cafe, saving for a new laptop. Every dollar is accounted for.',
  },
  {
    id: 'exec-evie',
    name: 'Evie',
    tagline: 'Senior director',
    icon: Building2,
    description:
      'High earner with lifestyle inflation. Great salary, but expensive taste. Saving for an investment property.',
  },
  {
    id: 'struggling-sanjay',
    name: 'Sanjay',
    tagline: 'Warehouse worker',
    icon: Package,
    description:
      'Living pay to pay. Trying to build an emergency fund while keeping up with the bills.',
  },
];

/** Icons for the budget totals, matching the ones the budget page uses. */
const TOTAL_ICONS = {
  income: BanknoteArrowUp,
  expense: BanknoteArrowDown,
  savings: PiggyBank,
} as const;

export function LandingPage({ onViewDemo }: LandingPageProps) {
  const { isAuthenticated, status: authStatus } = useAuth();
  const { isInitialized } = useAppConfig();

  // The only analytics call in the app. See src/lib/analytics.ts.
  useEffect(() => {
    trackLandingPageview();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <span className="text-lg font-semibold">SafelySpend</span>
        <div className="flex items-center gap-2">
          {isInitialized && (
            <Link
              to="/cash-flow"
              className="inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to app
            </Link>
          )}
          {/* Nothing is rendered while the session check is in flight, so the
              button never flickers from "Log in" to "My account".

              Signed in with no local data goes to /login rather than /settings:
              /settings sits inside RootLayout, which redirects back here until
              setup is done. /login owns the decision about where an
              authenticated visitor belongs (restore a vault, or set up fresh). */}
          {authStatus !== 'loading' && (
            <Link
              to={isAuthenticated && isInitialized ? '/settings' : '/login'}
              className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {isAuthenticated ? 'My account' : 'Log in'}
            </Link>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* 1. Hero */}
        <section className="px-4 pt-16 pb-14 sm:pt-24">
          <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
                Everything else is paid. Spend the rest.
              </h1>
              <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
                Most budgeting apps grade last month. This one starts with your income and takes out
                every commitment you have already made, so the number left over is safe to spend.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild className="gap-2">
                  <Link to="/?setup=1">
                    Get started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" onClick={() => onViewDemo()}>
                  Try with sample data
                </Button>
              </div>
            </div>

            {/* The budget page's own headline figure. */}
            <div className="w-full rounded-xl border bg-card p-8">
              <BudgetStatusHero {...BUDGET_STATUS} />
            </div>
          </div>
        </section>

        {/* The argument: a plan runs forward */}
        <section className="bg-[hsl(172_36%_11%)] px-4 py-20 text-[hsl(40_18%_92%)]">
          <div className="mx-auto max-w-5xl">
            {/* Group divider, tinted for the dark panel */}
            <div className="mb-10 flex items-center gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[hsl(40_12%_60%)]">
                Set it up once
              </h2>
              <span className="h-px flex-1 bg-[hsl(40_18%_92%)]/20" />
            </div>

            <h3 className="max-w-[20ch] text-3xl font-semibold leading-tight tracking-tight">
              Four totals, then your spending money
            </h3>
            <p className="mt-4 max-w-[58ch] leading-relaxed text-[hsl(40_12%_72%)]">
              Income at the top. Under it, your bills, your allowances, and what you are putting
              away each month.
            </p>
            <p className="mt-3 max-w-[58ch] leading-relaxed text-[hsl(40_12%_72%)]">
              You enter each one once, with its schedule. Pay every second Thursday, the electricity
              bill on the first, car insurance in March. The totals are a count of what lands this
              month, not an estimate of it.
            </p>
            <p className="mt-3 max-w-[58ch] leading-relaxed text-[hsl(40_12%_72%)]">
              The surplus above is whatever that subtraction leaves. Spend all of it and everything
              above still gets paid.
            </p>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {BUDGET_TOTALS.map((total) => (
                <BudgetSummaryCard
                  key={total.label}
                  label={total.label}
                  icon={TOTAL_ICONS[total.tone]}
                  tone={total.tone}
                  amountCents={total.amountCents}
                  subtitle={total.subtitle}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Bills vs spending allowances */}
        <section className="px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,32rem)] lg:gap-14">
              <div>
                <h3 className="text-xl font-semibold tracking-tight">
                  A bill is a number. An allowance is a limit.
                </h3>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  Your phone plan and your subscriptions are bills. You know the amount, so the app
                  just counts them.
                </p>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Groceries and fuel are not. You set a limit instead, and that limit is the only
                  part of the plan you can overspend.
                </p>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <p className="text-sm font-medium">Income Breakdown</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  How your {formatCents(MONTHLY_INCOME)} income is allocated
                </p>
                <div className="mt-4">
                  <SpendingBreakdownChart {...INCOME_BREAKDOWN} disableToggle />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,32rem)] lg:gap-14">
              <div>
                <h3 className="text-xl font-semibold tracking-tight">Where the leftover goes</h3>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  Give a goal a target and a deadline. The app works out whether your current pace
                  gets you there in time, interest included.
                </p>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Savings come out before the surplus, so what&apos;s left really is spare.
                </p>
              </div>
              <SavingsGoalProgressCard {...SAVINGS_GOAL} />
            </div>
          </div>
        </section>

        {/* Group divider */}
        <div className="mx-auto w-full max-w-5xl px-4 pt-20 pb-10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Then check in every couple of weeks
            </h2>
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>

        {/* 4. Check-ins */}
        <section className="px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,32rem)] lg:gap-14">
              <div>
                <h3 className="text-xl font-semibold tracking-tight">A two-minute check-in</h3>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  Import your transactions, confirm your bank balance, update your savings.
                  That&apos;s the whole thing.
                </p>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  It re-anchors everything, so the app keeps count of how long it has been and
                  nudges you when the next one is due.
                </p>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <CircleCheck className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-sm font-medium">Checked in, 14 March</span>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Cash balance</span>
                    <span className="font-mono font-semibold tabular-nums">
                      {formatCents(CHECK_IN.cashBalanceCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total savings</span>
                    <span className="font-mono font-semibold tabular-nums">
                      {formatCents(CHECK_IN.totalSavingsCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">End of month (plan)</span>
                    <span className="font-mono font-semibold tabular-nums text-green-600 dark:text-green-400">
                      {formatCents(CHECK_IN.endOfMonthCents)}
                    </span>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Budget pace</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {CHECK_IN.budgetsOnTrack}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CSV Import */}
        <section className="px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,32rem)] lg:gap-14">
              <div className="order-1">
                <h3 className="text-xl font-semibold tracking-tight">Import from your bank</h3>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  Drop in a CSV from your bank and the app works out the format. Anything that looks
                  like a duplicate gets flagged before it lands.
                </p>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Set up rules once (Woolworths to Groceries, Netflix to Entertainment) and later
                  imports categorise themselves.
                </p>
              </div>
              <div className="order-2">
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">3 transactions imported</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">Woolworths</p>
                        <p className="text-xs text-muted-foreground">14 Feb 2026</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Groceries</Badge>
                        <span className="font-mono tabular-nums">-{formatCents(8450)}</span>
                      </div>
                    </div>
                    <div className="border-t" />
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">Netflix</p>
                        <p className="text-xs text-muted-foreground">13 Feb 2026</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Entertainment</Badge>
                        <span className="font-mono tabular-nums">-{formatCents(1699)}</span>
                      </div>
                    </div>
                    <div className="border-t" />
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">Shell Coles Express</p>
                        <p className="text-xs text-muted-foreground">12 Feb 2026</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Transport</Badge>
                        <span className="font-mono tabular-nums">-{formatCents(6520)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Spending Pace */}
        <section className="px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,32rem)] lg:gap-14">
              <div className="order-1">
                <h3 className="text-xl font-semibold tracking-tight">
                  Find out mid-month, not after
                </h3>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  What you have spent against what you should have spent by this point in the month.
                  Easier to pull back in week two than in week four.
                </p>
              </div>
              <div className="order-2 space-y-3">
                {CATEGORY_SPEND.map((category, index) => (
                  <SpendingCard
                    key={category.label}
                    label={category.label}
                    spent={category.spent}
                    budget={category.budget}
                    colorIndex={index}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Burn rate / projection */}
        <section className="px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,32rem)] lg:gap-14">
              <div>
                <h3 className="text-xl font-semibold tracking-tight">
                  Where the month ends up, drawn
                </h3>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  Solid is what you have spent. Dashed is where you land if nothing changes.
                </p>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Not a straight-line guess: the projection steps on the days your bills fall, and
                  only your day-to-day spending gets averaged out.
                </p>
              </div>
              <SpendingPaceCard {...SPENDING_PACE} />
            </div>
          </div>
        </section>

        {/* Insights Charts */}
        <section className="px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,32rem)] lg:gap-14">
              <div className="order-1">
                <h3 className="text-xl font-semibold tracking-tight">Trends over time</h3>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  Monthly lines for what you earned, spent and saved. Good for picking out the
                  expensive months and checking whether your savings rate is going up.
                </p>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Separate charts cover spending by category and progress on each goal.
                </p>
              </div>
              <div className="order-2">
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">Cash Flow</span>
                  </div>
                  <div className="mt-4">
                    <CashFlowChart monthlyNetFlow={MONTHLY_NET_FLOW} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cloud Sync */}
        <section className="px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,32rem)] lg:gap-14">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Sync between devices</h2>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  Sync is off unless you turn it on. If you do, your data is encrypted on your
                  device first, so the server only ever holds a blob it can&apos;t read.
                </p>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  If another device synced first, it stops and asks which copy should win rather
                  than quietly overwriting one.
                </p>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <CloudOff className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Local-first</p>
                      <p className="text-sm text-muted-foreground">
                        Works offline. Your data lives on your device by default.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <ArrowLeftRight className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">No silent overwrites</p>
                      <p className="text-sm text-muted-foreground">
                        Sync from two devices and you get asked which copy wins.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Free, private, portable */}
        <section className="px-4 py-12">
          <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border bg-card p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Free to use</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  No paid tier, no trial that runs out. You only need an account to sync between
                  devices, and that is free too.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border bg-card p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Take your data with you</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  One button in Settings downloads the lot as a plain JSON file. If you leave, your
                  budget comes with you.
                </p>
                <p className="mt-2 text-sm">
                  <Link
                    to="/privacy"
                    className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    What I store, and what I don&apos;t
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Demo Personas */}
        <section className="bg-muted/40 px-4 py-20">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-semibold">Have a look around</h2>
              <p className="mt-2 text-muted-foreground">
                Pick someone below and poke around their budget. Nothing to sign up for.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PERSONAS.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => onViewDemo(persona.id)}
                  className="flex w-full cursor-pointer flex-col items-start rounded-xl border bg-card p-5 text-left transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <persona.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="mt-3 text-lg font-semibold">{persona.name}</p>
                  <p className="text-sm text-muted-foreground">{persona.tagline}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{persona.description}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 9. Final CTA */}
        <section className="mt-8 bg-[hsl(172_36%_11%)] px-4 py-20 text-center text-[hsl(40_18%_92%)]">
          <h2 className="mx-auto max-w-[24ch] text-3xl font-semibold leading-tight tracking-tight">
            If that is how you already think about money, this will fit
          </h2>
          <p className="mx-auto mt-4 max-w-[52ch] leading-relaxed text-[hsl(40_12%_72%)]">
            Load a sample budget and click around. Nothing to sign up for.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="gap-2">
              <Link to="/?setup=1">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => onViewDemo()}
              className="border-[hsl(40_18%_92%)]/35 bg-transparent text-[hsl(40_18%_92%)] hover:bg-[hsl(40_18%_92%)]/10 hover:text-[hsl(40_18%_92%)]"
            >
              Try with sample data
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>
          Built for personal use. Nothing you do inside the app is tracked, there are no ads, and
          your data isn&apos;t sold to anyone.
        </p>
        <p className="mt-2">
          <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy
          </Link>
        </p>
      </footer>
    </div>
  );
}

/**
 * One category's spend against budget, using the app's own progress bar. Over and
 * warning thresholds are derived the same way the cash flow page derives them.
 */
function SpendingCard({
  label,
  spent,
  budget,
  colorIndex,
}: {
  label: string;
  spent: number;
  budget: number;
  colorIndex: number;
}) {
  const percentage = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const isOverBudget = budget > 0 && spent > budget;
  const isWarning = percentage >= 80 && percentage < 100;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={isOverBudget ? 'text-red-600 dark:text-red-400' : ''}>
          {formatCents(spent)} of {formatCents(budget)}
        </span>
      </div>
      <div className="mt-2">
        <CategoryProgressBar
          percentage={percentage}
          color={getCategoryColor(colorIndex)}
          isOverBudget={isOverBudget}
          isWarning={isWarning}
        />
      </div>
    </div>
  );
}
