import { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate, Link } from 'react-router';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { DemoBanner } from '@/components/demo-banner';
import { DateRangeBanner } from '@/components/date-range-banner';
import { useScenarios } from '@/hooks/use-scenarios';
import { useViewState } from '@/hooks/use-view-state';
import { useAppConfig } from '@/hooks/use-app-config';
import { useDataDateRange } from '@/hooks/use-data-date-range';
import {
  STORAGE_QUOTA_EVENT,
  type StorageQuotaDetail,
} from '@/hooks/use-local-storage';

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
  const dataRange = useDataDateRange();
  const location = useLocation();
  const [storageWarning, setStorageWarning] = useState<StorageQuotaDetail | null>(null);

  const showDateControls = isDateRelevantRoute(location.pathname);

  // Listen for storage quota warnings
  useEffect(() => {
    const handleQuotaWarning = (event: Event) => {
      const detail = (event as CustomEvent<StorageQuotaDetail>).detail;
      setStorageWarning(detail);
    };

    window.addEventListener(STORAGE_QUOTA_EVENT, handleQuotaWarning);
    return () => window.removeEventListener(STORAGE_QUOTA_EVENT, handleQuotaWarning);
  }, []);

  if (!isInitialized) {
    return <Navigate to="/landing" replace />;
  }

  return (
    <div className="flex h-screen flex-col">
      {isDemo && <DemoBanner />}
      {storageWarning && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-sm text-amber-800 flex items-center justify-between">
          <span>
            {storageWarning.isFull ? (
              <>Storage is full. Please export and clear old data to continue.</>
            ) : (
              <>Storage is {Math.round(storageWarning.percentUsed)}% full. Consider exporting a backup.</>
            )}
          </span>
          <div className="flex gap-2">
            <Link to="/settings" className="underline font-medium">
              Go to Settings
            </Link>
            <button
              onClick={() => setStorageWarning(null)}
              className="ml-2 text-amber-600 hover:text-amber-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            scenarios={scenarios}
            activeScenarioId={activeScenarioId}
            onScenarioChange={setActiveScenarioId}
          />
          {showDateControls && (
            <DateRangeBanner
              startDate={startDate}
              endDate={endDate}
              onDateRangeChange={setDateRange}
              dataRange={dataRange}
            />
          )}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <Outlet context={{ activeScenarioId, startDate, endDate }} />
          </main>
        </div>
      </div>
    </div>
  );
}
