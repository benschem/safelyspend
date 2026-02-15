import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { applyMigrations, createAuthenticatedUser, appFetch } from '../helpers/setup.js';

beforeAll(async () => {
  await applyMigrations(env.DB);
});

function uploadRequest(
  cookie: string,
  data: Uint8Array,
  expectedVersion: number,
  idempotencyKey?: string,
): Request {
  const headers: Record<string, string> = {
    Cookie: cookie,
    'Content-Type': 'application/octet-stream',
    'X-Expected-Version': String(expectedVersion),
    'Content-Length': String(data.byteLength),
  };
  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
  }
  return new Request('http://localhost/v1/vault/data', {
    method: 'PUT',
    headers,
    body: data,
  });
}

/** Create a user and upload the given number of vault versions. */
async function setupVault(versionCount: number) {
  const { cookie } = await createAuthenticatedUser(env.DB);
  const versions: Array<{ data: Uint8Array; vaultId: string }> = [];

  for (let i = 0; i < versionCount; i++) {
    const data = new TextEncoder().encode(`vault-data-v${i + 1}`);
    const res = await appFetch(uploadRequest(cookie, data, i));
    const body = await res.json() as { version: number; vaultId: string };
    versions.push({ data, vaultId: body.vaultId });
  }

  return { cookie, versions };
}

describe('GET /vault (metadata)', () => {
  it('returns version 0 when no vault exists', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const res = await appFetch(
      new Request('http://localhost/v1/vault', { headers: { Cookie: cookie } }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: 0 });
  });

  it('returns version, size, and checksum after upload', async () => {
    const { cookie, versions } = await setupVault(1);
    const res = await appFetch(
      new Request('http://localhost/v1/vault', { headers: { Cookie: cookie } }),
    );

    expect(res.status).toBe(200);
    const body = await res.json() as {
      version: number;
      sizeBytes: number;
      checksum: string;
      updatedAt: string;
    };
    expect(body.version).toBe(1);
    expect(body.sizeBytes).toBe(versions[0].data.byteLength);
    expect(body.checksum).toBeTruthy();
    expect(body.updatedAt).toBeTruthy();
  });
});

describe('PUT /vault/data (upload)', () => {
  it('uploads first vault and returns version 1', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const data = new TextEncoder().encode('encrypted-vault-data-v1');

    const res = await appFetch(uploadRequest(cookie, data, 0));

    expect(res.status).toBe(200);
    const body = await res.json() as { version: number; vaultId: string };
    expect(body.version).toBe(1);
    expect(body.vaultId).toBeTruthy();
  });

  it('increments version on subsequent uploads', async () => {
    const { cookie } = await setupVault(1);
    const data = new TextEncoder().encode('vault-data-v2');

    const res = await appFetch(uploadRequest(cookie, data, 1));

    expect(res.status).toBe(200);
    const body = await res.json() as { version: number };
    expect(body.version).toBe(2);
  });

  it('rejects missing X-Expected-Version header', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const res = await appFetch(
      new Request('http://localhost/v1/vault/data', {
        method: 'PUT',
        headers: { Cookie: cookie, 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array([1, 2, 3]),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('BAD_REQUEST');
  });

  it('rejects wrong content-type', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const res = await appFetch(
      new Request('http://localhost/v1/vault/data', {
        method: 'PUT',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json',
          'X-Expected-Version': '0',
        },
        body: JSON.stringify({ data: 'test' }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('BAD_REQUEST');
  });

  it('returns 409 when expected version is stale', async () => {
    const { cookie } = await setupVault(1);
    const data = new TextEncoder().encode('stale-upload');

    const res = await appFetch(uploadRequest(cookie, data, 0));

    expect(res.status).toBe(409);
    const body = await res.json() as { currentVersion: number };
    expect(body.currentVersion).toBe(1);
  });
});

describe('GET /vault/data (download)', () => {
  it('returns 404 when no vault exists', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const res = await appFetch(
      new Request('http://localhost/v1/vault/data', { headers: { Cookie: cookie } }),
    );

    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('NOT_FOUND');
  });

  it('returns the uploaded data with version and checksum headers', async () => {
    const { cookie, versions } = await setupVault(1);
    const res = await appFetch(
      new Request('http://localhost/v1/vault/data', { headers: { Cookie: cookie } }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Vault-Version')).toBe('1');
    expect(res.headers.get('X-Vault-Checksum')).toBeTruthy();
    const downloaded = new Uint8Array(await res.arrayBuffer());
    expect(downloaded).toEqual(versions[0].data);
  });
});

describe('GET /vault/history', () => {
  it('lists versions in descending order', async () => {
    const { cookie } = await setupVault(2);
    const res = await appFetch(
      new Request('http://localhost/v1/vault/history', { headers: { Cookie: cookie } }),
    );

    expect(res.status).toBe(200);
    const body = await res.json() as {
      versions: Array<{ id: string; version: number; sizeBytes: number; checksum: string; createdAt: string }>;
    };
    expect(body.versions).toHaveLength(2);
    expect(body.versions[0].version).toBe(2);
    expect(body.versions[1].version).toBe(1);
  });
});

describe('GET /vault/data/:vaultId', () => {
  it('downloads a specific historical version', async () => {
    const { cookie, versions } = await setupVault(2);

    const res = await appFetch(
      new Request(`http://localhost/v1/vault/data/${versions[0].vaultId}`, {
        headers: { Cookie: cookie },
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Vault-Version')).toBe('1');
    const downloaded = new Uint8Array(await res.arrayBuffer());
    expect(downloaded).toEqual(versions[0].data);
  });

  it('returns 404 for nonexistent vault ID', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const res = await appFetch(
      new Request('http://localhost/v1/vault/data/nonexistent-id', {
        headers: { Cookie: cookie },
      }),
    );

    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('NOT_FOUND');
  });
});

describe('PUT /vault/data (idempotency)', () => {
  it('upload with idempotency key succeeds', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const data = new TextEncoder().encode('idempotent-upload');

    const res = await appFetch(uploadRequest(cookie, data, 0, 'idem-key-1'));

    expect(res.status).toBe(200);
    const body = await res.json() as { version: number; vaultId: string };
    expect(body.version).toBe(1);
    expect(body.vaultId).toBeTruthy();
  });

  it('retry with same idempotency key returns original result', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const data = new TextEncoder().encode('idempotent-retry');
    const key = 'idem-retry-key';

    // First upload
    const res1 = await appFetch(uploadRequest(cookie, data, 0, key));
    expect(res1.status).toBe(200);
    const body1 = await res1.json() as { version: number; vaultId: string };

    // Retry with same key and same expected version — should return original result
    const res2 = await appFetch(uploadRequest(cookie, data, 0, key));
    expect(res2.status).toBe(200);
    const body2 = await res2.json() as { version: number; vaultId: string };

    expect(body2.version).toBe(body1.version);
    expect(body2.vaultId).toBe(body1.vaultId);
  });

  it('different idempotency key creates new version', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const data1 = new TextEncoder().encode('first-upload');
    const data2 = new TextEncoder().encode('second-upload');

    const res1 = await appFetch(uploadRequest(cookie, data1, 0, 'key-a'));
    expect(res1.status).toBe(200);
    const body1 = await res1.json() as { version: number; vaultId: string };
    expect(body1.version).toBe(1);

    const res2 = await appFetch(uploadRequest(cookie, data2, 1, 'key-b'));
    expect(res2.status).toBe(200);
    const body2 = await res2.json() as { version: number; vaultId: string };
    expect(body2.version).toBe(2);
    expect(body2.vaultId).not.toBe(body1.vaultId);
  });

  it('upload without idempotency key still works', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const data = new TextEncoder().encode('no-idem-key');

    const res = await appFetch(uploadRequest(cookie, data, 0));

    expect(res.status).toBe(200);
    const body = await res.json() as { version: number; vaultId: string };
    expect(body.version).toBe(1);
    expect(body.vaultId).toBeTruthy();
  });
});

describe('vault owner isolation', () => {
  it('user A cannot read user B vault metadata', async () => {
    const { cookie: cookieA } = await createAuthenticatedUser(env.DB);
    const { cookie: cookieB } = await createAuthenticatedUser(env.DB);

    // User B uploads a vault
    const data = new TextEncoder().encode('user-b-secret');
    await appFetch(uploadRequest(cookieB, data, 0));

    // User A sees version 0 (no vault) — not user B's vault
    const res = await appFetch(
      new Request('http://localhost/v1/vault', { headers: { Cookie: cookieA } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: 0 });
  });

  it('user A cannot download user B vault data', async () => {
    const { cookie: cookieA } = await createAuthenticatedUser(env.DB);
    const { cookie: cookieB } = await createAuthenticatedUser(env.DB);

    // User B uploads a vault
    const data = new TextEncoder().encode('user-b-secret');
    await appFetch(uploadRequest(cookieB, data, 0));

    // User A gets 404 — no vault for them
    const res = await appFetch(
      new Request('http://localhost/v1/vault/data', { headers: { Cookie: cookieA } }),
    );
    expect(res.status).toBe(404);
  });

  it('user A cannot access user B vault by ID', async () => {
    const { cookie: cookieA } = await createAuthenticatedUser(env.DB);
    const { cookie: cookieB } = await createAuthenticatedUser(env.DB);

    // User B uploads a vault
    const data = new TextEncoder().encode('user-b-secret');
    const uploadRes = await appFetch(uploadRequest(cookieB, data, 0));
    const { vaultId } = await uploadRes.json() as { vaultId: string };

    // User A tries to access user B's vault by ID
    const res = await appFetch(
      new Request(`http://localhost/v1/vault/data/${vaultId}`, {
        headers: { Cookie: cookieA },
      }),
    );
    expect(res.status).toBe(404);
  });

  it('user A cannot see user B vault history', async () => {
    const { cookie: cookieA } = await createAuthenticatedUser(env.DB);
    const { cookie: cookieB } = await createAuthenticatedUser(env.DB);

    // User B uploads two versions
    const data1 = new TextEncoder().encode('v1');
    const data2 = new TextEncoder().encode('v2');
    await appFetch(uploadRequest(cookieB, data1, 0));
    await appFetch(uploadRequest(cookieB, data2, 1));

    // User A sees empty history
    const res = await appFetch(
      new Request('http://localhost/v1/vault/history', { headers: { Cookie: cookieA } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { versions: unknown[] };
    expect(body.versions).toHaveLength(0);
  });
});

describe('vault routes without auth', () => {
  it.each(['/v1/vault', '/v1/vault/data', '/v1/vault/history', '/v1/vault/data/some-id'])(
    'GET %s returns 401',
    async (path) => {
      const res = await appFetch(new Request(`http://localhost${path}`));
      expect(res.status).toBe(401);
    },
  );

  it('PUT /vault/data returns 401', async () => {
    const res = await appFetch(
      new Request('http://localhost/v1/vault/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream', 'X-Expected-Version': '0' },
        body: new Uint8Array([1]),
      }),
    );
    expect(res.status).toBe(401);
  });
});
