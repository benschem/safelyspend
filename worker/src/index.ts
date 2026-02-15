import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppError } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import vaultRoutes from './routes/vault.js';
import type { HonoEnv, JwtPayload } from './types.js';

const app = new Hono<HonoEnv>();

// Request ID middleware — must be first
app.use('*', async (c, next) => {
  c.set('requestId', crypto.randomUUID());
  await next();
});

// Security headers
app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});

// CORS middleware - use dynamic handler to access env
app.use('*', async (c, next) => {
  const appUrl = c.env.APP_URL;
  const allowedOrigins = [appUrl];
  if (c.env.ENVIRONMENT === 'development') {
    allowedOrigins.push('http://localhost:5173');
  }

  const corsMiddleware = cors({
    origin: (origin) => {
      if (allowedOrigins.includes(origin)) {
        return origin;
      }
      return '';
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Expected-Version', 'X-Idempotency-Key'],
    exposeHeaders: ['X-Vault-Version', 'X-Vault-Checksum', 'Retry-After'],
  });

  return corsMiddleware(c, next);
});

// Global error handler
app.onError((err, c) => {
  const requestId = c.get('requestId');

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

  // userId is only available after authMiddleware has run
  const userId = (c.get('jwtPayload') as JwtPayload | undefined)?.sub;

  console.error(JSON.stringify({
    event: 'unhandled_error',
    requestId,
    userId,
    method: c.req.method,
    path: c.req.path,
    error: err instanceof Error ? err.message : 'Unknown error',
    stack: err instanceof Error ? err.stack : undefined,
  }));
  return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
});

// Health check
app.get('/health', (c) => {
  return c.json({ ok: true });
});

// Mount routes
app.route('/v1/auth', authRoutes);
app.route('/v1/vault', vaultRoutes);

// 404 fallback
app.notFound((c) => {
  return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404);
});

export default app;
