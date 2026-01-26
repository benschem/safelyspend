import { Outlet } from 'react-router';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { usePeriods } from '@/hooks/use-periods';

export function RootLayout() {
  const { periods, activePeriodId, setActivePeriodId } = usePeriods();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          periods={periods}
          activePeriodId={activePeriodId}
          onPeriodChange={setActivePeriodId}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet context={{ activePeriodId }} />
        </main>
      </div>
    </div>
  );
}
