import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowRight,
  Banknote,
  Briefcase,
  Building2,
  CircleCheck,
  GraduationCap,
  Lock,
  Package,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { formatCents } from '@/lib/utils';

interface LandingPageProps {
  onViewDemo: () => void;
}

const PERSONAS = [
  {
    name: 'Paul',
    tagline: 'Marketing manager',
    icon: Briefcase,
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-500',
    description:
      'Comfortable and organised. Fortnightly pay, saving for a Japan trip and a house deposit. Occasionally splurges on nice dinners.',
  },
  {
    name: 'Soo-Jin',
    tagline: 'Uni student',
    icon: GraduationCap,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    description:
      'Tight budget but disciplined. Works part-time at a cafe, saving for a new laptop. Every dollar is accounted for.',
  },
  {
    name: 'Evie',
    tagline: 'Senior director',
    icon: Building2,
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-500',
    description:
      'High earner with lifestyle inflation. Great salary, but expensive taste. Saving for an investment property.',
  },
  {
    name: 'Sanjay',
    tagline: 'Warehouse worker',
    icon: Package,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    description:
      'Living paycheck to paycheck. Trying to build an emergency fund while keeping up with bills.',
  },
] as const;

export function LandingPage({ onViewDemo }: LandingPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <span className="text-lg font-semibold">SafelySpend</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled
                className="inline-flex h-8 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium opacity-50 shadow-sm"
              >
                Log in
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Accounts coming soon</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </header>

      <main className="flex flex-1 flex-col">
        {/* 1. Hero */}
        <section className="flex flex-col items-center justify-center bg-linear-to-b from-primary/5 to-transparent px-4 pt-16 pb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Know what you can safely spend
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            This budgeting app focuses on where your money can go. Your plan starts from your next payday and
            works backwards through bills, savings, and spending limits, leaving you with one clear
            number: what&apos;s actually yours to use.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild className="gap-2">
              <Link to="/?setup=1">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" onClick={onViewDemo}>
              Try with sample data
            </Button>
          </div>

          {/* Cash Flow Summary Preview */}
          <div className="mx-auto mt-10 w-full max-w-lg rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Banknote className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">February 2026</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  End of month (plan)
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-green-600 dark:text-green-400">
                  {formatCents(284700)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  At current pace
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-amber-600 dark:text-amber-400">
                  {formatCents(251200)}
                </p>
              </div>
            </div>

            <div className="my-4 border-t" />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cash balance right now</span>
              <span className="font-mono font-semibold tabular-nums">{formatCents(428000)}</span>
            </div>
          </div>
        </section>

        {/* 2. Demo Personas */}
        <section className="px-4 py-16 bg-muted/30">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-semibold">See it in action</h2>
              <p className="mt-2 text-muted-foreground">
                Pick a persona and explore with realistic sample data. No sign-up required.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PERSONAS.map((persona) => (
                <button
                  key={persona.name}
                  type="button"
                  onClick={onViewDemo}
                  className="w-full cursor-pointer rounded-xl border bg-card p-5 text-left transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${persona.iconBg}`}
                  >
                    <persona.icon className={`h-5 w-5 ${persona.iconColor}`} />
                  </div>
                  <p className="mt-3 text-lg font-semibold">{persona.name}</p>
                  <p className="text-sm text-muted-foreground">{persona.tagline}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{persona.description}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Savings Goals */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-4xl">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <h2 className="text-2xl font-semibold">Your surplus has a job</h2>
                <p className="mt-4 text-muted-foreground">
                  Every dollar above your spending is money working toward something — a holiday, an
                  emergency fund, a house deposit. Set targets with deadlines and the app tracks your
                  pace, including interest, so you know exactly when you&apos;ll get there.
                </p>
                <p className="mt-3 text-muted-foreground">
                  Savings aren&apos;t an afterthought. They&apos;re baked into the plan from the
                  start, deducted before you even see your surplus.
                </p>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">Japan Trip</p>
                      <p className="text-sm text-muted-foreground">Due Oct 2026</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                      <Target className="h-5 w-5 text-blue-500" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-sm">
                      <span>{formatCents(485000)} saved</span>
                      <span className="text-muted-foreground">{formatCents(800000)} goal</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-[61%] rounded-full bg-blue-500" />
                    </div>
                    <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                      On track to hit goal
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">Emergency Fund</p>
                      <p className="text-sm text-muted-foreground">No deadline set</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                      <Target className="h-5 w-5 text-emerald-500" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-sm">
                      <span>{formatCents(820000)} saved</span>
                      <span className="text-muted-foreground">{formatCents(1500000)} goal</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-[55%] rounded-full bg-emerald-500" />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">55% of the way there</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. What-If Scenarios */}
        <section className="border-y bg-muted/30 px-4 py-16">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-2xl font-semibold">Test decisions before you make them</h2>
            <p className="mt-2 text-muted-foreground">
              Thinking about a new car payment? A salary negotiation? Cutting subscriptions? Model it
              as a scenario and see what your end-of-month surplus looks like — then decide.
            </p>

            <div className="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-primary bg-primary/5 p-5 text-left">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                  <span className="font-medium">Current Plan</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Balanced lifestyle with steady savings
                </p>
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    End of month
                  </p>
                  <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-green-600 dark:text-green-400">
                    {formatCents(284700)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border-2 border-violet-500 bg-violet-500/5 p-5 text-left">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-500" />
                  <span className="font-medium">After the Raise</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  15% more income, boost savings rate
                </p>
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    End of month
                  </p>
                  <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-green-600 dark:text-green-400">
                    {formatCents(412000)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-violet-600 dark:text-violet-400">
                    +{formatCents(127300)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Budget Sliders */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-4xl">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <h2 className="text-2xl font-semibold">Dial in your plan</h2>
                <p className="mt-4 text-muted-foreground">
                  Slide to set income, spending limits, and savings contributions. Your projected
                  surplus updates as you go — so you can see the impact of every change before you
                  commit.
                </p>
                <p className="mt-3 text-muted-foreground">
                  Pair it with scenarios to compare plans side by side.
                </p>
              </div>
              <BudgetSliderPreview />
            </div>
          </div>
        </section>

        {/* 3. Monthly Breakdown */}
        <section className="border-y px-4 py-16">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-2xl font-semibold">Your month is one equation</h2>
            <p className="mt-2 text-muted-foreground">
              Income in. Bills out. Spending out. Savings out. What&apos;s left is your surplus — the
              money you can use freely without derailing a single thing.
            </p>

            <div className="mx-auto mt-10 max-w-lg rounded-xl border bg-card p-5 text-left">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">Monthly Breakdown</span>
              </div>

              <div className="-mx-5 mt-4 overflow-x-auto px-5">
                <div className="min-w-[280px]">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span />
                    <span className="w-16 text-right sm:w-20">Planned</span>
                    <span className="w-16 text-right sm:w-20">Current</span>
                  </div>

                  <BreakdownRow label="Starting cash" planned={428000} current={428000} />
                  <BreakdownRow
                    label="+ Income"
                    planned={725000}
                    current={510000}
                    prefix="+"
                    color="green"
                  />
                  <BreakdownRow label="− Fixed expenses" planned={-342000} current={-289000} />
                  <BreakdownRow label="− Variable spending" planned={-180000} current={-118000} />
                  <BreakdownRow label="− Savings" planned={-100000} current={-50000} />

                  <div className="my-2 border-t" />

                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 py-1">
                    <span className="text-sm font-semibold">Net change</span>
                    <span className="w-16 text-right font-mono text-sm font-bold tabular-nums text-green-600 dark:text-green-400 sm:w-20">
                      +{formatCents(103000)}
                    </span>
                    <span className="w-16 text-right font-mono text-sm font-bold tabular-nums text-green-600 dark:text-green-400 sm:w-20">
                      +{formatCents(53000)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Check-ins */}
        <section className="px-4 py-16 bg-muted/30">
          <div className="mx-auto max-w-4xl">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <h2 className="text-2xl font-semibold">Two minutes. Total clarity.</h2>
                <p className="mt-4 text-muted-foreground">
                  A regular check-in keeps your projections honest. Import your latest transactions,
                  confirm your bank balance, and update your savings — then get an instant snapshot of
                  where you stand. No spreadsheets. No mental maths.
                </p>
                <p className="mt-3 text-muted-foreground">
                  Because the app knows your real balance, it can tell you exactly where you&apos;ll
                  land at month end — not a guess, but a projection built on facts.
                </p>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                    <CircleCheck className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-sm font-medium">Check-in complete</span>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Cash balance</span>
                    <span className="font-mono font-semibold tabular-nums">
                      {formatCents(428000)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total savings</span>
                    <span className="font-mono font-semibold tabular-nums">
                      {formatCents(1305000)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">End of month (plan)</span>
                    <span className="font-mono font-semibold tabular-nums text-green-600 dark:text-green-400">
                      {formatCents(284700)}
                    </span>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Budget pace</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        8 of 9 on track
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Spending Pace */}
        <section className="border-y px-4 py-16">
          <div className="mx-auto max-w-4xl">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div className="order-2 space-y-3 lg:order-1">
                <SpendingCard
                  label="Groceries"
                  spent={41200}
                  budget={60000}
                  pct={69}
                  color="green"
                />
                <SpendingCard
                  label="Transport"
                  spent={18000}
                  budget={25000}
                  pct={72}
                  color="green"
                />
                <SpendingCard
                  label="Dining Out"
                  spent={26800}
                  budget={20000}
                  pct={100}
                  color="red"
                  over
                />
                <SpendingCard
                  label="Entertainment"
                  spent={4500}
                  budget={15000}
                  pct={30}
                  color="green"
                />
              </div>
              <div className="order-1 lg:order-2">
                <h2 className="text-2xl font-semibold">Know today, not at month end</h2>
                <p className="mt-4 text-muted-foreground">
                  Each category shows where you are versus where you should be at this point in the
                  month. Green means on pace. Red means slow down. You find out before it&apos;s a
                  problem — not after.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Insights Charts */}
        <section className="px-4 py-16 bg-muted/30">
          <div className="mx-auto max-w-4xl">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div className="order-2 lg:order-1">
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </div>
                    <span className="text-sm font-medium">Cash Flow</span>
                  </div>
                  <svg
                    viewBox="0 0 400 200"
                    className="mt-4 w-full"
                    role="img"
                    aria-label="Cash flow chart showing earned, spent, and saved over 6 months"
                  >
                    {/* Grid lines */}
                    <line x1="30" y1="30" x2="370" y2="30" stroke="currentColor" strokeOpacity="0.06" />
                    <line x1="30" y1="70" x2="370" y2="70" stroke="currentColor" strokeOpacity="0.06" />
                    <line x1="30" y1="110" x2="370" y2="110" stroke="currentColor" strokeOpacity="0.06" />
                    <line x1="30" y1="150" x2="370" y2="150" stroke="currentColor" strokeOpacity="0.06" />

                    {/* "Now" marker */}
                    <line x1="318" y1="15" x2="318" y2="165" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="4 3" />
                    <text x="318" y="12" textAnchor="middle" fill="#6b7280" fontSize="9" fontWeight="500">Now</text>

                    {/* Earned line (green) */}
                    <polyline
                      points="30,48 98,48 166,48 234,38 302,48 370,48"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Earned dots */}
                    <circle cx="30" cy="48" r="3" fill="#22c55e" />
                    <circle cx="98" cy="48" r="3" fill="#22c55e" />
                    <circle cx="166" cy="48" r="3" fill="#22c55e" />
                    <circle cx="234" cy="38" r="3" fill="#22c55e" />
                    <circle cx="302" cy="48" r="3" fill="#22c55e" />
                    <circle cx="370" cy="48" r="3" fill="#22c55e" />

                    {/* Spent line (red) */}
                    <polyline
                      points="30,82 98,70 166,88 234,62 302,78 370,92"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Spent dots */}
                    <circle cx="30" cy="82" r="3" fill="#ef4444" />
                    <circle cx="98" cy="70" r="3" fill="#ef4444" />
                    <circle cx="166" cy="88" r="3" fill="#ef4444" />
                    <circle cx="234" cy="62" r="3" fill="#ef4444" />
                    <circle cx="302" cy="78" r="3" fill="#ef4444" />
                    <circle cx="370" cy="92" r="3" fill="#ef4444" />

                    {/* Saved line (blue) */}
                    <polyline
                      points="30,138 98,145 166,130 234,148 302,135 370,128"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Saved dots */}
                    <circle cx="30" cy="138" r="3" fill="#3b82f6" />
                    <circle cx="98" cy="145" r="3" fill="#3b82f6" />
                    <circle cx="166" cy="130" r="3" fill="#3b82f6" />
                    <circle cx="234" cy="148" r="3" fill="#3b82f6" />
                    <circle cx="302" cy="135" r="3" fill="#3b82f6" />
                    <circle cx="370" cy="128" r="3" fill="#3b82f6" />

                    {/* X-axis labels */}
                    <text x="30" y="180" textAnchor="middle" fill="currentColor" fillOpacity="0.4" fontSize="10">Sep</text>
                    <text x="98" y="180" textAnchor="middle" fill="currentColor" fillOpacity="0.4" fontSize="10">Oct</text>
                    <text x="166" y="180" textAnchor="middle" fill="currentColor" fillOpacity="0.4" fontSize="10">Nov</text>
                    <text x="234" y="180" textAnchor="middle" fill="currentColor" fillOpacity="0.4" fontSize="10">Dec</text>
                    <text x="302" y="180" textAnchor="middle" fill="currentColor" fillOpacity="0.4" fontSize="10">Jan</text>
                    <text x="370" y="180" textAnchor="middle" fill="currentColor" fillOpacity="0.4" fontSize="10">Feb</text>
                  </svg>
                  {/* Legend */}
                  <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      Earned
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      Spent
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Saved
                    </span>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <h2 className="text-2xl font-semibold">See the bigger picture</h2>
                <p className="mt-4 text-muted-foreground">
                  Monthly lines for earned, spent, and saved show your trends at a glance. Spot
                  seasonal patterns, track whether your savings rate is growing, and see exactly
                  where you are right now.
                </p>
                <p className="mt-3 text-muted-foreground">
                  Separate charts for spending by category and savings goal progress give you the
                  full story.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Privacy & Trust */}
        <section className="px-4 py-12 bg-muted/30">
          <div className="mx-auto flex max-w-xl items-center gap-4 rounded-xl border bg-card p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-500/10">
              <Lock className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="font-medium">Your data never leaves your browser</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No accounts. No servers. No tracking. Everything is stored locally. Export your data
                anytime. Delete it anytime.
              </p>
            </div>
          </div>
        </section>

        {/* 9. Final CTA */}
        <section className="px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold">Ready to take control of your cash flow?</h2>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="gap-2">
              <Link to="/?setup=1">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" onClick={onViewDemo}>
              Try with sample data
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>Built for personal use. No tracking. No analytics.</p>
      </footer>
    </div>
  );
}

function BreakdownRow({
  label,
  planned,
  current,
  prefix,
  color,
}: {
  label: string;
  planned: number;
  current: number;
  prefix?: string;
  color?: 'green';
}) {
  const colorClass = color === 'green' ? 'text-green-600 dark:text-green-400' : '';

  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`w-16 text-right font-mono text-sm tabular-nums sm:w-20 ${colorClass}`}>
        {prefix}
        {formatCents(Math.abs(planned))}
      </span>
      <span className={`w-16 text-right font-mono text-sm tabular-nums sm:w-20 ${colorClass}`}>
        {prefix}
        {formatCents(Math.abs(current))}
      </span>
    </div>
  );
}

const DEMO_SLIDERS = [
  { label: 'Salary', initial: 725000, min: 0, max: 1450000, step: 2500, variant: 'income' as const },
  { label: 'Rent', initial: 185000, min: 0, max: 370000, step: 2500, variant: 'expense' as const },
  { label: 'Groceries', initial: 60000, min: 0, max: 120000, step: 1000, variant: 'expense' as const },
  { label: 'Japan Trip', initial: 50000, min: 0, max: 100000, step: 1000, variant: 'savings' as const },
];

const VARIANT_STYLES = {
  income: {
    track: '[&_[data-radix-slider-range]]:bg-green-500',
    thumb: '[&_[data-radix-slider-thumb]]:border-green-500',
    text: 'text-green-600 dark:text-green-400',
  },
  expense: {
    track: '[&_[data-radix-slider-range]]:bg-rose-500',
    thumb: '[&_[data-radix-slider-thumb]]:border-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
  },
  savings: {
    track: '[&_[data-radix-slider-range]]:bg-blue-500',
    thumb: '[&_[data-radix-slider-thumb]]:border-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
  },
};

function BudgetSliderPreview() {
  const [values, setValues] = useState(() => DEMO_SLIDERS.map((s) => s.initial));

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-medium">Budget Plan</span>
      </div>
      <div className="mt-4 space-y-4">
        {DEMO_SLIDERS.map((slider, i) => {
          const styles = VARIANT_STYLES[slider.variant];
          const value = values[i] ?? slider.initial;
          return (
            <div key={slider.label} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{slider.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-sm font-semibold tabular-nums ${styles.text}`}>
                    {formatCents(value)}
                  </span>
                  <span className="text-xs text-muted-foreground">per month</span>
                </div>
              </div>
              <Slider
                aria-label={slider.label}
                value={[value]}
                min={slider.min}
                max={slider.max}
                step={slider.step}
                onValueChange={([v]) =>
                  setValues((prev) => {
                    const next = [...prev];
                    next[i] = v ?? slider.initial;
                    return next;
                  })
                }
                className={`cursor-pointer ${styles.track} ${styles.thumb}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SpendingCard({
  label,
  spent,
  budget,
  pct,
  color,
  over,
}: {
  label: string;
  spent: number;
  budget: number;
  pct: number;
  color: 'green' | 'red';
  over?: boolean;
}) {
  const barColor = color === 'green' ? 'bg-green-500' : 'bg-red-500';
  const textColor = over ? 'text-red-600 dark:text-red-400' : '';

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={textColor}>
          {formatCents(spent)} of {formatCents(budget)}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
