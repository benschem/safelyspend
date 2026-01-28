import { Outlet, Navigate } from 'react-router';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { DemoBanner } from '@/components/demo-banner';
import { useScenarios } from '@/hooks/use-scenarios';
import { useAppConfig } from '@/hooks/use-app-config';

export function RootLayout() {
  const { isInitialized, isDemo, isLoading: configLoading } = useAppConfig();
  const { activeScenarioId, isLoading: scenariosLoading } = useScenarios();

  // Show nothing while loading initial config
  if (configLoading) {
    return null;
  }

  if (!isInitialized) {
    return <Navigate to="/landing" replace />;
  }

  // Show nothing while loading scenarios after initialisation
  if (scenariosLoading) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col">
      {isDemo && <DemoBanner />}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          {/* Portal target for page-specific sticky headers */}
          <div id="sticky-header-portal" />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <Outlet context={{ activeScenarioId }} />
          </main>
        </div>
      </div>
    </div>
  );
}
