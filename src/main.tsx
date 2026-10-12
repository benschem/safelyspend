import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './hooks/use-theme';
// Installs the Plausible queue stub at boot, before anything can call it.
import './lib/analytics';
import { trackVisualViewport } from './lib/visual-viewport';
import '@fontsource-variable/dm-sans';
import './index.css';

trackVisualViewport();

const STALE_CHUNK_RELOAD_KEY = 'budget:staleChunkReloadedAt';
const STALE_CHUNK_RELOAD_COOLDOWN_MS = 10_000;

// A tab left open across a deploy asks for route chunks that no longer exist.
// Reloading picks up the new index.html and its new chunk hashes. The cooldown
// stops a reload loop when a chunk is missing for some other reason - the second
// failure falls through to the route ErrorBoundary instead.
window.addEventListener('vite:preloadError', (event) => {
  const lastReloadedAt = Number(sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY));
  const reloadedRecently = Date.now() - lastReloadedAt < STALE_CHUNK_RELOAD_COOLDOWN_MS;
  if (reloadedRecently) return;

  // Stops Vite rethrowing, so the error page does not flash before the reload.
  event.preventDefault();
  sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
