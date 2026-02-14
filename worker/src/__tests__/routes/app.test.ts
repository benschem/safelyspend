import { describe, it, expect } from 'vitest';
import { appFetch } from '../helpers/setup.js';

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await appFetch(new Request('http://localhost/health'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('GET /nonexistent', () => {
  it('returns 404', async () => {
    const res = await appFetch(new Request('http://localhost/nonexistent'));
    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('NOT_FOUND');
  });
});
