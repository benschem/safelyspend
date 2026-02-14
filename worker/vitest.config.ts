import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/__tests__/helpers/email-mock.ts'],
    poolOptions: {
      workers: {
        miniflare: {
          bindings: {
            JWT_SECRET: 'test-jwt-secret-for-integration-tests',
            RESEND_API_KEY: 'test-resend-api-key',
          },
        },
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
});
