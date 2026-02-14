import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppError } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import vaultRoutes from './routes/vault.js';
import type { HonoEnv } from './types.js';

const app = new Hono<HonoEnv>();

// CORS middleware - use dynamic handler to access env
app.use('*', async (c, next) => {
  const appUrl = c.env.APP_URL;
  const allowedOrigins = [appUrl, 'http://localhost:5173'];

  const corsMiddleware = cors({
    origin: (origin) => {
      if (allowedOrigins.includes(origin)) {
        return origin;
      }
      return '';
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Expected-Version'],
    exposeHeaders: ['X-Vault-Version', 'X-Vault-Checksum'],
  });

  return corsMiddleware(c, next);
});

// Global error handler
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(
      {
        error: err.message,
        code: err.code,
        ...(err.data ? { data: err.data } : {}),
      },
      err.status as 400 | 401 | 403 | 404 | 409 | 429 | 500,
    );
  }

  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
});

// Health check
app.get('/health', (c) => {
  return c.json({ ok: true });
});

// Mount routes
app.route('/auth', authRoutes);
app.route('/vault', vaultRoutes);

// 404 fallback
app.notFound((c) => {
  return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404);
});

export default app;
