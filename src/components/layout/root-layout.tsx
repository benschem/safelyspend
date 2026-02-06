import { Outlet, Navigate, useLocation } from 'react-router';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { DemoBanner } from '@/components/demo-banner';
import { PageErrorBoundary } from '@/components/page-error-boundary';
import { useScenarios } from '@/hooks/use-scenarios';
import { useAppConfig } from '@/hooks/use-app-config';
import { WhatIfProvider } from '@/contexts/what-if-context';
import { WhatIfBanner } from '@/components/what-if-banner';

export function RootLayout() {
  const location = useLocation();
  const { isInitialized, isDemo, isLoading: configLoading } = useAppConfig();
  const { activeScenarioId, isLoading: scenariosLoading } = useScenarios();

  // Show nothing while loading initial config
  if (configLoading) {
    return null;
  }

  if (!isInitialized) {
    // Preserve query params when redirecting to landing
    return <Navigate to={`/landing${location.search}`} replace />;
  }

  // Show nothing while loading scenarios after initialisation
  if (scenariosLoading) {
    return null;
  }

  return (
    <WhatIfProvider activeScenarioId={activeScenarioId}>
      <div className="flex h-screen flex-col">
        {/* Skip to main content link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        {isDemo && <DemoBanner />}
        <WhatIfBanner />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <main id="main-content" className="flex-1 overflow-y-auto p-4 sm:p-6">
              <PageErrorBoundary>
                <Outlet context={{ activeScenarioId }} />
              </PageErrorBoundary>
            </main>
          </div>
        </div>
      </div>
    </WhatIfProvider>
  );
}
