import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        bindings: {
          JWT_SECRET: 'test-jwt-secret-for-integration-tests',
          RESEND_API_KEY: 'test-resend-api-key',
        },
      },
      wrangler: { configPath: './wrangler.toml' },
    }),
  ],
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/__tests__/helpers/email-mock.ts'],
  },
});
