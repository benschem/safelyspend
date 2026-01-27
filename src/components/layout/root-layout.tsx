import { Outlet } from 'react-router';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useScenarios } from '@/hooks/use-scenarios';
import { useViewState } from '@/hooks/use-view-state';

export function RootLayout() {
  const { scenarios, activeScenarioId, setActiveScenarioId } = useScenarios();
  const { startDate, endDate, setDateRange, resetToFinancialYear } = useViewState();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          scenarios={scenarios}
          activeScenarioId={activeScenarioId}
          onScenarioChange={setActiveScenarioId}
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={setDateRange}
          onResetDateRange={resetToFinancialYear}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet context={{ activeScenarioId, startDate, endDate }} />
        </main>
      </div>
    </div>
  );
}
