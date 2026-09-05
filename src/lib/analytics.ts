/**
 * Landing page analytics.
 *
 * Self-hosted Plausible, loaded through the /pa-stats/* Netlify proxy (see
 * netlify.toml) so it stays same-origin and needs no CSP exceptions.
 *
 * This uses Plausible's `manual` script variant, which fires no pageviews of
 * its own. Nothing is measured unless something here asks for it, so adding a
 * route can never start tracking by accident.
 *
 * There is exactly one caller: the landing page, which only renders for
 * visitors who have not set the app up yet. Adding a second caller would mean
 * measuring what people do inside a budgeting app, which /privacy promises we
 * don't do. Change the promise first.
 */

type PlausibleArgs = [eventName: string, options?: { props?: Record<string, string> }];

interface Plausible {
  (...args: PlausibleArgs): void;
  q?: PlausibleArgs[];
}

declare global {
  interface Window {
    plausible?: Plausible;
  }
}

/**
 * The tracker script is deferred, so a call can land before it has loaded.
 * Plausible drains this queue once it starts, so nothing is lost.
 */
function installQueueStub(): void {
  if (window.plausible) return;

  const stub: Plausible = (...args: PlausibleArgs) => {
    stub.q = stub.q ?? [];
    stub.q.push(args);
  };

  window.plausible = stub;
}

installQueueStub();

let hasTrackedLandingPageview = false;

/**
 * Records a single landing page view. Guarded so React's StrictMode double
 * effect in development, and any remount, can't inflate the count.
 */
export function trackLandingPageview(): void {
  if (hasTrackedLandingPageview) return;
  hasTrackedLandingPageview = true;

  window.plausible?.('pageview');
}
