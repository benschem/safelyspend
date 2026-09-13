import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { applyMigrations, authedRequest, createAuthenticatedUser, appFetch } from '../helpers/setup.js';
import { EnvelopeKind, FORMAT_VERSION } from '../../lib/key-material.js';

beforeAll(async () => {
  await applyMigrations(env.DB);
});

/** A structurally valid format-v2 vault envelope carrying a recognisable payload.
 *  The server rejects anything that does not lead with VERSION and KIND, so test
 *  payloads can no longer be bare text. */
function vaultBytes(label: string, padTo = 0): Uint8Array {
  const payload = new TextEncoder().encode(label);
  // VERSION + KIND + IV(12) + ciphertext + GCM tag(16)
  const length = Math.max(2 + 12 + payload.byteLength + 16, padTo);
  const bytes = new Uint8Array(length);
  bytes[0] = FORMAT_VERSION;
  bytes[1] = EnvelopeKind.Vault;
  bytes.set(payload, 14);
  return bytes;
}

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

/** Create a household with one member and upload the given number of vault versions. */
async function setupVault(versionCount: number) {
  const { cookie, householdId } = await createAuthenticatedUser(env.DB);
  const versions: Array<{ data: Uint8Array; vaultId: string }> = [];

  for (let i = 0; i < versionCount; i++) {
    const data = vaultBytes(`vault-data-v${i + 1}`);
    const res = await appFetch(uploadRequest(cookie, data, i));
    const body = (await res.json()) as { version: number; vaultId: string };
    versions.push({ data, vaultId: body.vaultId });
  }

  return { cookie, householdId, versions };
}

describe('GET /vault (metadata)', () => {
  it('returns version 0 when no vault exists', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const res = await appFetch(authedRequest('/v1/vault', cookie));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: 0 });
  });

  it('returns version, size and checksum after an upload', async () => {
    const { cookie, versions } = await setupVault(1);
    const res = await appFetch(authedRequest('/v1/vault', cookie));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      version: number;
      sizeBytes: number;
      checksum: string;
      updatedAt: string;
    };
    expect(body.version).toBe(1);
    expect(body.sizeBytes).toBe(versions[0]!.data.byteLength);
    expect(body.checksum).toBeTruthy();
    expect(body.updatedAt).toBeTruthy();
  });
});

describe('PUT /vault/data (upload)', () => {
  it('uploads the first vault and returns version 1', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(uploadRequest(cookie, vaultBytes('v1'), 0));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number; vaultId: string };
    expect(body.version).toBe(1);
    expect(body.vaultId).toBeTruthy();
  });

  it('increments the version on subsequent uploads', async () => {
    const { cookie } = await setupVault(1);

    const res = await appFetch(uploadRequest(cookie, vaultBytes('v2'), 1));

    expect(res.status).toBe(200);
    expect(((await res.json()) as { version: number }).version).toBe(2);
  });

  it('rejects a blob that does not lead with the format-v2 version byte', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const legacy = vaultBytes('old-format');
    legacy[0] = 0x01;

    const res = await appFetch(uploadRequest(cookie, legacy, 0));

    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('INVALID_BLOB');
  });

  it('rejects a blob carrying the wrong envelope kind', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const wrongKind = vaultBytes('not-a-vault');
    wrongKind[1] = EnvelopeKind.WrappedMasterKey;

    const res = await appFetch(uploadRequest(cookie, wrongKind, 0));

    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('INVALID_BLOB');
  });

  it('rejects a missing X-Expected-Version header', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const res = await appFetch(
      new Request('http://localhost/v1/vault/data', {
        method: 'PUT',
        headers: { Cookie: cookie, 'Content-Type': 'application/octet-stream' },
        body: vaultBytes('v1'),
      }),
    );

    expect(res.status).toBe(400);
  });

  it('rejects the wrong content type', async () => {
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
  });

  it('returns 409 when the expected version is stale', async () => {
    const { cookie } = await setupVault(1);

    const res = await appFetch(uploadRequest(cookie, vaultBytes('stale'), 0));

    expect(res.status).toBe(409);
    expect(((await res.json()) as { currentVersion: number }).currentVersion).toBe(1);
  });
});

describe('GET /vault/data (download)', () => {
  it('returns 404 when no vault exists', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const res = await appFetch(authedRequest('/v1/vault/data', cookie));

    expect(res.status).toBe(404);
  });

  it('returns the uploaded bytes with the version and checksum headers', async () => {
    const { cookie, versions } = await setupVault(1);
    const res = await appFetch(authedRequest('/v1/vault/data', cookie));

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Vault-Version')).toBe('1');
    expect(res.headers.get('X-Vault-Checksum')).toBeTruthy();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(versions[0]!.data);
  });
});

describe('GET /vault/history', () => {
  it('lists versions newest first', async () => {
    const { cookie } = await setupVault(2);
    const res = await appFetch(authedRequest('/v1/vault/history', cookie));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { versions: Array<{ version: number }> };
    expect(body.versions).toHaveLength(2);
    expect(body.versions[0]!.version).toBe(2);
    expect(body.versions[1]!.version).toBe(1);
  });
});

describe('GET /vault/data/:vaultId', () => {
  it('downloads a specific historical version', async () => {
    const { cookie, versions } = await setupVault(2);

    const res = await appFetch(authedRequest(`/v1/vault/data/${versions[0]!.vaultId}`, cookie));

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Vault-Version')).toBe('1');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(versions[0]!.data);
  });

  it('returns 404 for an unknown vault id', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const res = await appFetch(authedRequest('/v1/vault/data/nonexistent-id', cookie));

    expect(res.status).toBe(404);
  });
});

describe('PUT /vault/data (idempotency)', () => {
  it('returns the original result when the same key is retried', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    const data = vaultBytes('idempotent-retry');

    const first = (await (await appFetch(uploadRequest(cookie, data, 0, 'idem-retry'))).json()) as {
      version: number;
      vaultId: string;
    };
    const second = (await (await appFetch(uploadRequest(cookie, data, 0, 'idem-retry'))).json()) as {
      version: number;
      vaultId: string;
    };

    expect(second).toEqual(first);
  });

  it('creates a new version for a different key', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);

    const first = (await (
      await appFetch(uploadRequest(cookie, vaultBytes('first'), 0, 'key-a'))
    ).json()) as { version: number; vaultId: string };
    const second = (await (
      await appFetch(uploadRequest(cookie, vaultBytes('second'), 1, 'key-b'))
    ).json()) as { version: number; vaultId: string };

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(second.vaultId).not.toBe(first.vaultId);
  });

  it('works without an idempotency key', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(uploadRequest(cookie, vaultBytes('no-key'), 0));

    expect(res.status).toBe(200);
    expect(((await res.json()) as { version: number }).version).toBe(1);
  });
});

describe('household scoping', () => {
  it('both members of a household see the same vault', async () => {
    const owner = await createAuthenticatedUser(env.DB);
    const partner = await createAuthenticatedUser(env.DB, {
      joinHouseholdId: owner.householdId!,
    });

    const data = vaultBytes('shared-budget');
    await appFetch(uploadRequest(owner.cookie, data, 0));

    const res = await appFetch(authedRequest('/v1/vault/data', partner.cookie));

    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(data);
  });

  it('a partner picks up where the other left off, version-wise', async () => {
    const owner = await createAuthenticatedUser(env.DB);
    const partner = await createAuthenticatedUser(env.DB, {
      joinHouseholdId: owner.householdId!,
    });

    await appFetch(uploadRequest(owner.cookie, vaultBytes('owner-v1'), 0));
    const res = await appFetch(uploadRequest(partner.cookie, vaultBytes('partner-v2'), 1));

    expect(res.status).toBe(200);
    expect(((await res.json()) as { version: number }).version).toBe(2);
  });

  it('a stale push from one partner loses to the other, rather than overwriting', async () => {
    const owner = await createAuthenticatedUser(env.DB);
    const partner = await createAuthenticatedUser(env.DB, {
      joinHouseholdId: owner.householdId!,
    });

    await appFetch(uploadRequest(owner.cookie, vaultBytes('owner-v1'), 0));

    // The partner still believes the vault is at version 0.
    const res = await appFetch(uploadRequest(partner.cookie, vaultBytes('partner-stale'), 0));

    expect(res.status).toBe(409);
    expect(((await res.json()) as { currentVersion: number }).currentVersion).toBe(1);
  });

  it('a user in a different household sees nothing', async () => {
    const theirs = await createAuthenticatedUser(env.DB);
    const outsider = await createAuthenticatedUser(env.DB);

    await appFetch(uploadRequest(theirs.cookie, vaultBytes('their-secret'), 0));

    expect(await (await appFetch(authedRequest('/v1/vault', outsider.cookie))).json()).toEqual({
      version: 0,
    });
    expect((await appFetch(authedRequest('/v1/vault/data', outsider.cookie))).status).toBe(404);
    expect(
      ((await (await appFetch(authedRequest('/v1/vault/history', outsider.cookie))).json()) as {
        versions: unknown[];
      }).versions,
    ).toHaveLength(0);
  });

  it('a vault id from another household is not readable', async () => {
    const theirs = await createAuthenticatedUser(env.DB);
    const outsider = await createAuthenticatedUser(env.DB);

    const uploaded = (await (
      await appFetch(uploadRequest(theirs.cookie, vaultBytes('their-secret'), 0))
    ).json()) as { vaultId: string };

    const res = await appFetch(
      authedRequest(`/v1/vault/data/${uploaded.vaultId}`, outsider.cookie),
    );

    expect(res.status).toBe(404);
  });

  it('a user with no household cannot reach the vault at all', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB, { withoutHousehold: true });

    const res = await appFetch(authedRequest('/v1/vault', cookie));

    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('NO_HOUSEHOLD');
  });
});

describe('PUT /vault/data (storage quota)', () => {
  it('rejects an upload that would exceed the household quota', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);
    // 50 MB quota, 10 MB per upload: five 9 MB versions fit, the sixth does not.
    const nineMegabytes = 9 * 1024 * 1024;
    const largeData = vaultBytes('bulk', nineMegabytes);

    for (let i = 0; i < 5; i++) {
      expect((await appFetch(uploadRequest(cookie, largeData, i))).status).toBe(200);
    }

    const res = await appFetch(uploadRequest(cookie, largeData, 5));

    expect(res.status).toBe(413);
    const body = (await res.json()) as {
      code: string;
      data: { currentBytes: number; maxBytes: number };
    };
    expect(body.code).toBe('QUOTA_EXCEEDED');
    expect(body.data.currentBytes).toBe(5 * nineMegabytes);
    expect(body.data.maxBytes).toBe(50 * 1024 * 1024);
  });

  it('allows an upload well under the quota', async () => {
    const { cookie } = await createAuthenticatedUser(env.DB);

    const res = await appFetch(uploadRequest(cookie, vaultBytes('small', 1024), 0));

    expect(res.status).toBe(200);
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
        body: vaultBytes('v1'),
      }),
    );
    expect(res.status).toBe(401);
  });
});
