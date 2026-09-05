import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './hooks/use-theme';
// Installs the Plausible queue stub at boot, before anything can call it.
import './lib/analytics';
import '@fontsource-variable/dm-sans';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
