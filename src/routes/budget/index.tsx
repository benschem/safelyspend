import { useState, useEffect } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { Activity, Target, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/page-loading';
import { useScenarios } from '@/hooks/use-scenarios';
import { cn } from '@/lib/utils';
import { OverviewTab } from './overview-tab';
import { PlanTab } from './plan-tab';
import { HistoryTab } from './history-tab';

const VALID_TABS = ['overview', 'plan', 'history'] as const;
type TabValue = (typeof VALID_TABS)[number];
const STORAGE_KEY = 'budget:activeTab';

const TAB_CONFIG = [
  { value: 'overview' as const, label: 'Pulse', icon: Activity, color: 'text-sky-500' },
  { value: 'plan' as const, label: 'Plan', icon: Target, color: 'text-violet-500' },
  { value: 'history' as const, label: 'History', icon: History, color: 'text-slate-500' },
];

const TAB_SUBTITLES: Record<TabValue, string> = {
  overview: 'Track your spending against your plan',
  plan: 'Plan your spending and savings',
  history: 'Review your transaction history',
};

interface OutletContext {
  activeScenarioId: string | null;
}

export function BudgetPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario, isLoading } = useScenarios();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state: localStorage persists selection, URL param overrides for direct links
  const [activeTab, setActiveTab] = useState<TabValue>(() => {
    const urlTab = searchParams.get('tab') as TabValue | null;
    if (urlTab && VALID_TABS.includes(urlTab)) return urlTab;
    const stored = localStorage.getItem(STORAGE_KEY) as TabValue | null;
    if (stored && VALID_TABS.includes(stored)) return stored;
    return 'overview';
  });

  // Handle URL param override (for direct links)
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
        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">
            <div className="page-title-icon bg-slate-500/10">
              <Target className="h-5 w-5 text-slate-500" />
            </div>
            Budget
          </h1>
          <p className="page-description">{TAB_SUBTITLES[activeTab]}</p>
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
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <div className="page-title-icon bg-slate-500/10">
            <Target className="h-5 w-5 text-slate-500" />
          </div>
          Budget
        </h1>
        <p className="page-description">{TAB_SUBTITLES[activeTab]}</p>
      </div>

      {/* Tab Bar */}
      <div className="inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleTabChange(tab.value)}
            className={cn(
              'inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all',
              activeTab === tab.value
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:text-foreground',
            )}
          >
            <tab.icon className={cn('h-4 w-4', activeTab === tab.value && tab.color)} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab activeScenarioId={activeScenarioId} />}
      {activeTab === 'plan' && <PlanTab activeScenarioId={activeScenarioId} />}
      {activeTab === 'history' && <HistoryTab activeScenarioId={activeScenarioId} />}
    </div>
  );
}
