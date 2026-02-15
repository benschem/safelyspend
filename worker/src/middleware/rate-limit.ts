import type { MiddlewareHandler } from 'hono';
import { AppError, tooManyRequests } from '../lib/errors.js';
import type { HonoEnv, User } from '../types.js';

interface RateLimitConfig {
  /** Maximum number of requests in the window */
  max: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Key prefix for namespacing different limiters */
  keyPrefix: string;
}

/**
 * Check rate limit using a single INSERT ... ON CONFLICT ... RETURNING query.
 * Usable inline (e.g. per-email checks) without the middleware wrapper.
 */
export async function checkRateLimit(
  db: D1Database,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = Math.floor(Date.now() / 1000);
  const resetAt = now + windowSeconds;

  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
         reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END
       RETURNING count, reset_at`,
    )
    .bind(key, resetAt, now, now, resetAt)
    .first<{ count: number; reset_at: number }>();

  if (!row) return { allowed: true, retryAfter: 0 };

  if (row.count > max) {
    return { allowed: false, retryAfter: Math.max(1, row.reset_at - now) };
  }
  return { allowed: true, retryAfter: 0 };
}

/** IP-based rate limit middleware. Degrades open on D1 failure. */
export function rateLimit(config: RateLimitConfig): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
    const key = `${config.keyPrefix}:${ip}`;

    try {
      const result = await checkRateLimit(c.env.DB, key, config.max, config.windowSeconds);

      if (!result.allowed) {
        c.header('Retry-After', String(result.retryAfter));
        const requestId = c.get('requestId');
        const userId = (c.get('user') as User | undefined)?.id;
        console.warn(JSON.stringify({ event: 'rate_limited', requestId, userId, limiter: config.keyPrefix }));
        throw tooManyRequests('Too many requests. Please try again later.');
      }
    } catch (err) {
      // Re-throw rate limit rejections
      if (err instanceof AppError) throw err;
      // D1 failure — degrade open rather than blocking all requests
      console.error(JSON.stringify({
        event: 'rate_limit_degraded', requestId: c.get('requestId'),
        limiter: config.keyPrefix,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }

    // Probabilistic cleanup of expired entries (1% of requests)
    const now = Math.floor(Date.now() / 1000);
    if (Math.random() < 0.01) {
      c.executionCtx.waitUntil(
        c.env.DB.prepare('DELETE FROM rate_limits WHERE reset_at <= ?').bind(now).run()
          .catch((cleanupErr) => console.error(JSON.stringify({
            event: 'background_task_failed',
            task: 'rate_limit_cleanup',
            error: cleanupErr instanceof Error ? cleanupErr.message : 'Unknown error',
          }))),
      );
    }

    await next();
  };
}

/** Authenticated user rate limit middleware. Degrades open on D1 failure. */
export function userRateLimit(config: RateLimitConfig): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const user = c.get('user');
    const key = `${config.keyPrefix}:user:${user.id}`;

    try {
      const result = await checkRateLimit(c.env.DB, key, config.max, config.windowSeconds);

      if (!result.allowed) {
        c.header('Retry-After', String(result.retryAfter));
        console.warn(JSON.stringify({
          event: 'rate_limited', requestId: c.get('requestId'),
          userId: user.id, limiter: `${config.keyPrefix}:user`,
        }));
        throw tooManyRequests('Too many requests. Please try again later.');
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error(JSON.stringify({
        event: 'rate_limit_degraded', requestId: c.get('requestId'),
        userId: user.id, limiter: `${config.keyPrefix}:user`,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }

    await next();
  };
}
