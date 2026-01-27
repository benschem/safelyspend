import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Calendar,
  LineChart,
  PiggyBank,
  Receipt,
  GitBranch,
  Lock,
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onViewDemo: () => void;
}

export function LandingPage({ onGetStarted, onViewDemo }: LandingPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center px-4 py-20 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <LineChart className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight">SafelySpend</h1>
          <p className="mt-4 max-w-lg text-xl text-muted-foreground">
            A personal finance tool that tells you how much you can safely spend.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={onGetStarted} className="gap-2">
              Get started
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={onViewDemo}>
              View demo
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Demo loads sample data so you can explore without entering your own.
          </p>
        </section>

        {/* Value Prop */}
        <section className="border-y bg-muted/30 px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold">
              Know what you can actually spend
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Most budgeting apps tell you where your money went. This one tells you
              where it can go. Given your income, bills, and savings goals, how much
              is actually free to spend between now and your next paycheck?
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-10 text-center text-2xl font-semibold">
              What it does
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={Receipt}
                title="Track transactions"
                description="Log income, expenses, and savings as they happen"
              />
              <FeatureCard
                icon={Calendar}
                title="Set recurring rules"
                description="Define your salary, rent, subscriptions, and regular transfers"
              />
              <FeatureCard
                icon={LineChart}
                title="Forecast your balance"
                description="See what your account will look like weeks or months from now"
              />
              <FeatureCard
                icon={PiggyBank}
                title="Manage savings goals"
                description="Track progress toward specific targets with deadlines"
              />
              <FeatureCard
                icon={GitBranch}
                title="Compare scenarios"
                description="Model different plans to see how choices affect your finances"
              />
              <FeatureCard
                icon={Lock}
                title="Private by design"
                description="All data stays in your browser. No accounts, no servers."
              />
            </div>
          </div>
        </section>

        {/* Privacy callout */}
        <section className="border-t bg-muted/30 px-4 py-12">
          <div className="mx-auto flex max-w-xl items-center gap-4 rounded-lg border bg-background p-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Lock className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium">Your data never leaves your device</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No accounts. No logins. No uploads. Nothing is synced anywhere.
              </p>
            </div>
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

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
