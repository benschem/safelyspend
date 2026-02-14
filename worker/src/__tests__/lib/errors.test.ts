import { describe, it, expect } from 'vitest';
import {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooManyRequests,
  internal,
} from '../../lib/errors.js';

describe('AppError', () => {
  it('creates error with message, status, and code', () => {
    const error = new AppError('Something broke', 500, 'INTERNAL_ERROR');
    expect(error.message).toBe('Something broke');
    expect(error.status).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.name).toBe('AppError');
  });

  it('is instanceof Error', () => {
    const error = new AppError('test', 400, 'BAD_REQUEST');
    expect(error).toBeInstanceOf(Error);
  });

  it('includes optional data', () => {
    const error = new AppError('conflict', 409, 'CONFLICT', {
      serverVersion: 5,
    });
    expect(error.data).toEqual({ serverVersion: 5 });
  });
});

describe('error factories', () => {
  it('badRequest → 400 BAD_REQUEST', () => {
    const error = badRequest('Invalid input');
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Invalid input');
  });

  it('unauthorized → 401 UNAUTHORIZED', () => {
    const error = unauthorized('Not logged in');
    expect(error.status).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('forbidden → 403 FORBIDDEN', () => {
    const error = forbidden('Access denied');
    expect(error.status).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  it('notFound → 404 NOT_FOUND', () => {
    const error = notFound('Resource missing');
    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('conflict → 409 CONFLICT with data', () => {
    const error = conflict('Version mismatch', { serverVersion: 3 });
    expect(error.status).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.data).toEqual({ serverVersion: 3 });
  });

  it('tooManyRequests → 429 TOO_MANY_REQUESTS', () => {
    const error = tooManyRequests('Slow down');
    expect(error.status).toBe(429);
    expect(error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('internal → 500 INTERNAL_ERROR', () => {
    const error = internal('Server broke');
    expect(error.status).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
  });
});
