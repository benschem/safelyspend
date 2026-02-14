import type { MiddlewareHandler } from 'hono';
import { tooManyRequests } from '../lib/errors.js';
import type { HonoEnv } from '../types.js';

interface RateLimitConfig {
  /** Maximum number of requests in the window */
  max: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Key prefix for namespacing different limiters */
  keyPrefix: string;
}

export function rateLimit(config: RateLimitConfig): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const db = c.env.DB;
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
    const key = `${config.keyPrefix}:${ip}`;
    const now = Math.floor(Date.now() / 1000);
    const resetAt = now + config.windowSeconds;

    // Check current count before incrementing
    const row = await db
      .prepare('SELECT count, reset_at FROM rate_limits WHERE key = ?')
      .bind(key)
      .first<{ count: number; reset_at: number }>();

    // Reject if at or over limit and window still active
    if (row && row.reset_at > now && row.count >= config.max) {
      const retryAfter = Math.max(1, row.reset_at - now);
      c.header('Retry-After', String(retryAfter));
      console.warn(JSON.stringify({ event: 'rate_limited', limiter: config.keyPrefix }));
      throw tooManyRequests('Too many requests. Please try again later.');
    }

    // Increment only if request is allowed
    await db
      .prepare(
        `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET
           count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
           reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END`,
      )
      .bind(key, resetAt, now, now, resetAt)
      .run();

    // Probabilistic cleanup of expired entries (1% of requests)
    if (Math.random() < 0.01) {
      c.executionCtx.waitUntil(
        db.prepare('DELETE FROM rate_limits WHERE reset_at <= ?').bind(now).run()
          .catch((err) => console.error(JSON.stringify({
            event: 'background_task_failed',
            task: 'rate_limit_cleanup',
            error: err instanceof Error ? err.message : 'Unknown error',
          }))),
      );
    }

    await next();
  };
}
