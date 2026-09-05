import { Suspense, lazy } from 'react';
import type { PersonaId } from '@/lib/demo-personas';

const LandingPage = lazy(() =>
  import('@/components/landing-page').then((m) => ({ default: m.LandingPage })),
);

/**
 * The public landing page at a stable URL.
 *
 * The root route ("/") switches between this page and the app depending on
 * whether setup has been completed, so it cannot be linked to from inside the
 * app. /welcome always renders the landing page, which is what the header logo
 * and any shared marketing link point at.
 */
export function WelcomePage() {
  const handleStartDemo = async (personaId?: PersonaId) => {
    const { startDemoSession } = await import('@/lib/demo-data');
    await startDemoSession(personaId);
  };

  return (
    <Suspense fallback={null}>
      <LandingPage onViewDemo={handleStartDemo} />
    </Suspense>
  );
}
