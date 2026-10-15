import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // One run covers both: the app here, and the worker under its own config,
    // which runs inside workerd.
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          globals: true,
          environment: 'happy-dom',
          // Dates are local, and the date bugs only show when the local date and
          // the UTC date differ. One fixed zone makes them show on every machine.
          env: { TZ: 'Australia/Sydney' },
          setupFiles: ['./src/__tests__/setup.ts'],
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        },
      },
      './worker/vitest.config.ts',
    ],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/__tests__/'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
