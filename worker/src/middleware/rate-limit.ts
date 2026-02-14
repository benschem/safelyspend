import type { MiddlewareHandler } from 'hono';
import { tooManyRequests } from '../lib/errors.js';
import type { HonoEnv } from '../types.js';

/**
 * Simple per-IP rate limiting using D1.
 * Uses a sliding window counter stored in memory via a Map.
 * For production scale, consider using Cloudflare's Rate Limiting product
 * or Durable Objects for distributed state.
 *
 * This implementation uses a lightweight in-memory approach that resets
 * per-isolate. Sufficient for single-region deployments and basic protection.
 */

interface RateLimitConfig {
  /** Maximum number of requests in the window */
  max: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Key prefix for namespacing different limiters */
  keyPrefix: string;
}

// In-memory store (per-isolate, resets on cold start)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

export function rateLimit(config: RateLimitConfig): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
    const key = `${config.keyPrefix}:${ip}`;
    const now = Date.now();

    // Periodic cleanup (every 100th request)
    if (Math.random() < 0.01) {
      cleanupExpired();
    }

    let entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      // Start new window
      entry = {
        count: 1,
        resetAt: now + config.windowSeconds * 1000,
      };
      rateLimitStore.set(key, entry);
    } else {
      entry.count++;
    }

    if (entry.count > config.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      throw tooManyRequests('Too many requests. Please try again later.');
    }

    await next();
  };
}
