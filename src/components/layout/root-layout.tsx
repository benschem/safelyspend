import { Outlet, useLocation } from 'react-router';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { DemoBanner } from '@/components/demo-banner';
import { DateRangeBanner } from '@/components/date-range-banner';
import { FirstRunWizard } from '@/components/first-run-wizard';
import { useScenarios } from '@/hooks/use-scenarios';
import { useViewState } from '@/hooks/use-view-state';
import { useAppConfig } from '@/hooks/use-app-config';

// Routes where date range filtering applies
const DATE_RELEVANT_ROUTES = ['/dashboard', '/forecast', '/budget', '/transactions', '/reports'];

function isDateRelevantRoute(pathname: string): boolean {
  return DATE_RELEVANT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  );
}

export function RootLayout() {
  const { isInitialized, isDemo } = useAppConfig();
  const { scenarios, activeScenarioId, setActiveScenarioId } = useScenarios();
  const { startDate, endDate, setDateRange } = useViewState();
  const location = useLocation();

  const showDateControls = isDateRelevantRoute(location.pathname);

  if (!isInitialized) {
    return <FirstRunWizard />;
  }

  return (
    <div className="flex h-screen flex-col">
      {isDemo && <DemoBanner />}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            scenarios={scenarios}
            activeScenarioId={activeScenarioId}
            onScenarioChange={setActiveScenarioId}
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={setDateRange}
            showDatePicker={showDateControls}
          />
          {showDateControls && <DateRangeBanner startDate={startDate} endDate={endDate} />}
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet context={{ activeScenarioId, startDate, endDate }} />
          </main>
        </div>
      </div>
    </div>
  );
}
