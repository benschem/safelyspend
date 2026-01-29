import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Landmark,
  PiggyBank,
  Ambulance,
  Lock,
  TrendingUp,
  TrendingDown,
  CircleGauge,
  Target,
  GitBranch,
  Wallet,
} from 'lucide-react';
import { formatCents } from '@/lib/utils';

interface LandingPageProps {
  onViewDemo: () => void;
}

export function LandingPage({ onViewDemo }: LandingPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center px-4 pt-16 pb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Know what you can safely spend
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Not what you've already spent. What's actually left after bills, savings, and upcoming expenses.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild className="gap-2">
              <Link to="/?setup=1">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" onClick={onViewDemo}>
              Explore demo
            </Button>
          </div>
        </section>

        {/* Live Preview - Snapshot Cards */}
        <section className="px-4 pb-16">
          <div className="mx-auto max-w-4xl">
            {/* Net Worth Hero */}
            <div className="mb-6 rounded-xl border bg-card p-6 text-center">
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Net Worth
              </p>
              <p className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
                {formatCents(7893000)}
              </p>
              <div className="mx-auto mt-4 mb-3 h-px w-24 bg-border" />
              <p className="text-sm text-muted-foreground">
                More than 52% of Australians
              </p>
            </div>

            {/* Asset Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10">
                  <Landmark className="h-5 w-5 text-sky-500" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Cash</p>
                <p className="mt-1 text-xl font-semibold">{formatCents(428000)}</p>
                <div className="mt-3 mb-2 h-px bg-border" />
                <p className="text-sm text-muted-foreground">In your everyday account</p>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                  <PiggyBank className="h-5 w-5 text-blue-500" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Dedicated Savings</p>
                <p className="mt-1 text-xl font-semibold">{formatCents(2645000)}</p>
                <div className="mt-3 mb-2 h-px bg-border" />
                <p className="text-sm text-muted-foreground">For your future goals</p>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                  <Ambulance className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Emergency Fund</p>
                <p className="mt-1 text-xl font-semibold">{formatCents(4820000)}</p>
                <div className="mt-3 mb-2 h-px bg-border" />
                <p className="text-sm text-muted-foreground">For life's surprises</p>
              </div>
            </div>
          </div>
        </section>

        {/* Value Prop */}
        <section className="border-y bg-muted/30 px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold">
              Most budgeting apps tell you where your money went
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              This one tells you where it can go. Given your pay cycle, upcoming bills, and savings goals, how much is actually free between now and your next payday?
            </p>
          </div>
        </section>

        {/* Feature: Budget Tracking */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-4xl">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <h2 className="text-2xl font-semibold">
                  Set budgets. See how you're tracking.
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Get warned before you overspend, not after. Weekly, fortnightly, or monthly budgets that match how you actually get paid.
                </p>
              </div>
              <div className="space-y-4">
                {/* Budget Progress Examples */}
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                      <CircleGauge className="h-4 w-4 text-green-500" />
                    </div>
                    <p className="text-sm text-muted-foreground">Spending speed</p>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-green-600">On Track</p>
                  <p className="mt-2 text-sm text-muted-foreground">8 of 9 budgets on pace</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>Groceries</span>
                    <span className="text-muted-foreground">$412 of $600</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-[69%] rounded-full bg-green-500" />
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>Dining Out</span>
                    <span className="text-red-600">$268 of $200</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-full rounded-full bg-red-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature: Cash Flow */}
        <section className="border-y bg-muted/30 px-4 py-16">
          <div className="mx-auto max-w-4xl">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div className="order-2 lg:order-1">
                {/* Simplified Cash Flow Preview */}
                <div className="rounded-xl border bg-card p-5">
                  <div className="grid grid-cols-4 gap-4">
                    {/* Income/Expense Summary Cards */}
                    <div className="col-span-2 rounded-lg border p-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">Income</p>
                      <p className="mt-1 text-lg font-semibold">{formatCents(725000)}</p>
                    </div>
                    <div className="col-span-2 rounded-lg border p-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">Expenses</p>
                      <p className="mt-1 text-lg font-semibold">{formatCents(489000)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 p-4">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Net this month</span>
                    </div>
                    <span className="text-lg font-semibold text-green-600">+{formatCents(236000)}</span>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <h2 className="text-2xl font-semibold">
                  See what's coming before it hits
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Plan around lumpy expenses like car rego, insurance, or that trip you're saving for. Know what your account will look like next month, or in six months.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Feature: Savings Goals */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-4xl">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <h2 className="text-2xl font-semibold">
                  Track progress on what matters
                </h2>
                <p className="mt-4 text-muted-foreground">
                  House deposit, holiday fund, emergency buffer. Set targets with deadlines and see when you'll get there. Interest calculations included.
                </p>
              </div>
              <div className="space-y-4">
                {/* Savings Goal Cards */}
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">Japan Trip</p>
                      <p className="text-sm text-muted-foreground">Due Oct 2025</p>
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
                    <p className="mt-2 text-sm text-green-600">On track to hit goal</p>
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">House Deposit</p>
                      <p className="text-sm text-muted-foreground">No deadline set</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                      <Target className="h-5 w-5 text-emerald-500" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-sm">
                      <span>{formatCents(2160000)} saved</span>
                      <span className="text-muted-foreground">{formatCents(8000000)} goal</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-[27%] rounded-full bg-emerald-500" />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">27% of the way there</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature: Scenarios */}
        <section className="border-y bg-muted/30 px-4 py-16">
          <div className="mx-auto max-w-4xl">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div className="order-2 lg:order-1">
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Scenarios</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="rounded-lg border-2 border-primary bg-primary/5 p-3">
                      <p className="font-medium">Current Plan</p>
                      <p className="text-sm text-muted-foreground">Balanced lifestyle with steady savings</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="font-medium">Cut Back Mode</p>
                      <p className="text-sm text-muted-foreground">Reduce dining out, pause subscriptions</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="font-medium">After the Raise</p>
                      <p className="text-sm text-muted-foreground">15% more income, boost savings rate</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <h2 className="text-2xl font-semibold">
                  What if you got a raise?
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Or cut back on Uber Eats? Model different plans and see how the numbers change. Compare scenarios side by side without messing with your actual budget.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Demo Personas */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-semibold">Not sure where to start?</h2>
              <p className="mt-2 text-muted-foreground">
                Pick a persona and explore with sample data. See how different financial situations play out.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <PersonaCard
                name="Paul"
                tagline="Marketing manager"
                description="Comfortable and organised. Fortnightly pay, saving for a Japan trip and a house deposit. Occasionally splurges on nice dinners."
                onSelect={onViewDemo}
              />
              <PersonaCard
                name="Soo-Jin"
                tagline="Uni student"
                description="Tight budget but disciplined. Works part-time at a cafe, saving for a new laptop. Every dollar is accounted for."
                onSelect={onViewDemo}
              />
              <PersonaCard
                name="Evie"
                tagline="Senior director"
                description="High earner with lifestyle inflation. Great salary, but expensive taste. Saving for an investment property."
                onSelect={onViewDemo}
              />
              <PersonaCard
                name="Sanjay"
                tagline="Warehouse worker"
                description="Living paycheck to paycheck. Trying to build an emergency fund while keeping up with bills."
                onSelect={onViewDemo}
              />
            </div>
          </div>
        </section>

        {/* Privacy Section */}
        <section className="border-t bg-muted/30 px-4 py-12">
          <div className="mx-auto flex max-w-xl items-center gap-4 rounded-xl border bg-background p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Lock className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium">Your data stays on your device</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No accounts. No logins. No servers. Everything lives in your browser's local storage. Clear it anytime.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold">Ready to see what you can safely spend?</h2>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="gap-2">
              <Link to="/?setup=1">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" onClick={onViewDemo}>
              Explore demo
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

function PersonaCard({
  name,
  tagline,
  description,
  onSelect,
}: {
  name: string;
  tagline: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-semibold">{name}</p>
          <p className="text-sm text-muted-foreground">{tagline}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onSelect}>
        Try this demo
      </Button>
    </div>
  );
}
