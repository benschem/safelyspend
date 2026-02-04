import { useState } from 'react';
import { Link, Navigate, useOutletContext, useSearchParams } from 'react-router';
import { Target } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/page-loading';
import { useScenarios } from '@/hooks/use-scenarios';
import { PlanTab } from './plan-tab';
import type { BudgetPeriodValue } from './plan-tab';

interface OutletContext {
  activeScenarioId: string | null;
}

export function BudgetPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario, isLoading } = useScenarios();
  const [searchParams] = useSearchParams();
  const [breakdownPeriod, setBreakdownPeriod] = useState<BudgetPeriodValue>('monthly');

  // Legacy redirect: ?tab=overview now lives at /cash-flow
  if (searchParams.get('tab') === 'overview') {
    return <Navigate to="/cash-flow" replace />;
  }

  if (isLoading) {
    return (
      <div className="page-shell">
        <PageLoading />
      </div>
    );
  }

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="page-shell space-y-6">
        <div className="page-header">
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <Target className="h-5 w-5 text-slate-500" />
            </div>
            Budget
          </h1>
          <p className="page-description">Plan your spending and savings</p>
        </div>

        <div className="empty-state">
          <p className="empty-state-text">Select a scenario from the banner to view your budget.</p>
          <Button asChild className="empty-state-action">
            <Link to="/scenarios">Manage Scenarios</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      <div className="page-header flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <Target className="h-5 w-5 text-slate-500" />
            </div>
            Budget
          </h1>
          <p className="page-description">Plan your spending and savings</p>
        </div>
        <Select
          value={breakdownPeriod}
          onValueChange={(v) => setBreakdownPeriod(v as BudgetPeriodValue)}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Per week</SelectItem>
            <SelectItem value="fortnightly">Per fortnight</SelectItem>
            <SelectItem value="monthly">Per month</SelectItem>
            <SelectItem value="quarterly">Per quarter</SelectItem>
            <SelectItem value="yearly">Per year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <PlanTab activeScenarioId={activeScenarioId} breakdownPeriod={breakdownPeriod} />
    </div>
  );
}
