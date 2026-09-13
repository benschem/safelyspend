import { AppError, badRequest, coded, tooManyRequests } from '../lib/errors.js';
import { checkRateLimit } from '../middleware/rate-limit.js';
import type { AppContext } from '../types.js';

/** Parse a JSON body, rejecting the wrong content type and anything oversized.
 *
 *  The size cap is per-route: an OTP request is a kilobyte, while a signup carries
 *  four wrapped keys and needs far more headroom. */
export async function parseJsonBody<T>(c: AppContext, maxBytes: number): Promise<T> {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw badRequest('Content-Type must be application/json');
  }

  // Fast reject via Content-Length before reading anything
  const contentLength = parseInt(c.req.header('content-length') ?? '0', 10);
  if (contentLength > maxBytes) {
    throw badRequest('Request body too large');
  }

  // Defence in depth: a client can lie about or omit Content-Length
  const text = await c.req.text();
  if (text.length > maxBytes) {
    throw badRequest('Request body too large');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw badRequest('Invalid JSON');
  }
}

/** The household the request is scoped to, for routes that sit behind requireHousehold.
 *
 *  The context variable is `string | null` because routes that do not require a
 *  household share the same type. Stating the invariant once here, in a name, beats
 *  asserting it with `as string` at every call site and leaving the next reader to walk
 *  back up the middleware chain to check it still holds. */
export function householdIdOrThrow(c: AppContext): string {
  const householdId = c.get('householdId');
  if (!householdId) {
    throw coded('No household yet', 409, 'NO_HOUSEHOLD');
  }
  return householdId;
}

/** A rate limit keyed by something the request identifies rather than by client IP. */
export interface SubjectRateLimit {
  /** Names the limiter in logs and prefixes its key, e.g. 'auth:login:email'. */
  limiter: string;
  /** What is being limited: an email address before the user is known, a user id
   *  afterwards. Appended to `limiter` to form the key. */
  subject: string;
  /** Requests permitted per window. */
  max: number;
  windowSeconds: number;
}

/** Apply a rate limit from inside a handler.
 *
 *  Prefer the `userRateLimit` middleware wherever the subject is the authenticated
 *  user — it is declarative and sits with the other guards in the route definition.
 *  This exists for the auth routes, where the subject is a submitted email or a user
 *  id that only falls out of spending the bridge token, and so is not known until the
 *  handler is already running.
 *
 *  Degrades open on a D1 failure, matching the middleware: a broken limiter should not
 *  take the whole API down with it. */
export async function enforceSubjectRateLimit(
  c: AppContext,
  limit: SubjectRateLimit,
): Promise<void> {
  const key = `${limit.limiter}:${limit.subject}`;

  try {
    const result = await checkRateLimit(c.env.DB, key, limit.max, limit.windowSeconds);
    if (!result.allowed) {
      c.header('Retry-After', String(result.retryAfter));
      console.warn(JSON.stringify({
        event: 'rate_limited',
        requestId: c.get('requestId'),
        limiter: limit.limiter,
      }));
      throw tooManyRequests('Too many requests. Please try again later.');
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error(JSON.stringify({
      event: 'rate_limit_degraded',
      requestId: c.get('requestId'),
      limiter: limit.limiter,
      error: err instanceof Error ? err.message : 'Unknown error',
    }));
  }
}
