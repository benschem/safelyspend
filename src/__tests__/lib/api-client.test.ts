import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { api, ApiError } from '@/lib/api-client';

let mockFetch: Mock;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);
});

/** Helper to create a successful JSON Response. */
function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** Helper to create an error JSON Response. */
function errorResponse(
  status: number,
  error: string,
  extra?: Record<string, unknown>,
) {
  return new Response(JSON.stringify({ error, ...extra }), {
    status,
    statusText: error,
    headers: { 'Content-Type': 'application/json' },
  });
}

// =============================================================================
// api.auth
// =============================================================================

describe('api.auth', () => {
  describe('login', () => {
    it('sends POST to /auth/login with email in JSON body', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ message: 'Code sent' }),
      );

      await api.auth.login('user@example.com');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/auth/login');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body as string)).toEqual({
        email: 'user@example.com',
      });
    });

    it('returns parsed response on success', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: 'Code sent' }));

      const result = await api.auth.login('user@example.com');
      expect(result).toEqual({ message: 'Code sent' });
    });

    it('throws ApiError with status and message on failure', async () => {
      mockFetch.mockResolvedValue(
        errorResponse(400, 'Invalid email'),
      );

      await expect(api.auth.login('bad')).rejects.toThrow(ApiError);
      await mockFetch.mockResolvedValue(
        errorResponse(400, 'Invalid email'),
      );
      try {
        await api.auth.login('bad');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).status).toBe(400);
        expect((e as ApiError).message).toBe('Invalid email');
      }
    });

    it('includes credentials: include', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: 'ok' }));

      await api.auth.login('user@example.com');

      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(opts.credentials).toBe('include');
    });
  });

  describe('verify', () => {
    it('sends POST to /auth/verify with email and code', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ user: { id: 'u1', email: 'user@example.com' } }),
      );

      await api.auth.verify('user@example.com', '123456');

      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/auth/verify');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body as string)).toEqual({
        email: 'user@example.com',
        code: '123456',
      });
    });

    it('returns { user } on success', async () => {
      const user = { id: 'u1', email: 'user@example.com' };
      mockFetch.mockResolvedValue(jsonResponse({ user }));

      const result = await api.auth.verify('user@example.com', '123456');
      expect(result).toEqual({ user });
    });

    it('throws ApiError on 401', async () => {
      mockFetch.mockResolvedValue(
        errorResponse(401, 'Invalid code'),
      );

      await expect(
        api.auth.verify('user@example.com', '000000'),
      ).rejects.toThrow(ApiError);
    });
  });

  describe('logout', () => {
    it('sends POST to /auth/logout', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: 'Logged out' }));

      await api.auth.logout();

      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/auth/logout');
      expect(opts.method).toBe('POST');
    });
  });

  describe('me', () => {
    it('sends GET to /auth/me', async () => {
      const user = { id: 'u1', email: 'user@example.com' };
      mockFetch.mockResolvedValue(jsonResponse({ user }));

      await api.auth.me();

      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/auth/me');
      // GET is the default - no explicit method set
      expect(opts.method).toBeUndefined();
    });

    it('returns { user } when authenticated', async () => {
      const user = { id: 'u1', email: 'user@example.com' };
      mockFetch.mockResolvedValue(jsonResponse({ user }));

      const result = await api.auth.me();
      expect(result).toEqual({ user });
    });

    it('throws ApiError on 401', async () => {
      mockFetch.mockResolvedValue(
        errorResponse(401, 'Unauthorized'),
      );

      await expect(api.auth.me()).rejects.toThrow(ApiError);
    });
  });

  describe('deleteAccount', () => {
    it('sends DELETE to /auth/account', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ message: 'Account deleted' }),
      );

      await api.auth.deleteAccount();

      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/auth/account');
      expect(opts.method).toBe('DELETE');
    });
  });
});

// =============================================================================
// api.vault
// =============================================================================

describe('api.vault', () => {
  describe('getMetadata', () => {
    it('sends GET to /vault and returns metadata', async () => {
      const metadata = {
        version: 5,
        sizeBytes: 1024,
        checksum: 'abc123',
        updatedAt: '2026-02-15T00:00:00.000Z',
      };
      mockFetch.mockResolvedValue(jsonResponse(metadata));

      const result = await api.vault.getMetadata();

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/vault');
      expect(result).toEqual(metadata);
    });
  });

  describe('getData', () => {
    it('returns ArrayBuffer and version from X-Vault-Version header', async () => {
      const body = new Uint8Array([1, 2, 3, 4]).buffer;
      const response = new Response(body, {
        status: 200,
        headers: { 'X-Vault-Version': '7' },
      });
      mockFetch.mockResolvedValue(response);

      const result = await api.vault.getData();

      expect(result.version).toBe(7);
      expect(new Uint8Array(result.data)).toEqual(new Uint8Array([1, 2, 3, 4]));
    });
  });

  describe('putData', () => {
    it('sends PUT with ArrayBuffer body and X-Expected-Version header', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ version: 2, vaultId: 'v1' }),
      );
      const data = new Uint8Array([10, 20, 30]).buffer;

      await api.vault.putData(data, 1);

      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/vault/data');
      expect(opts.method).toBe('PUT');
      expect((opts.headers as Record<string, string>)['X-Expected-Version']).toBe('1');
      expect((opts.headers as Record<string, string>)['Content-Type']).toBe(
        'application/octet-stream',
      );
    });

    it('returns { version, vaultId } on success', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ version: 2, vaultId: 'v1' }),
      );
      const data = new Uint8Array([10, 20, 30]).buffer;

      const result = await api.vault.putData(data, 1);
      expect(result).toEqual({ version: 2, vaultId: 'v1' });
    });

    it('throws ApiError 409 on version conflict', async () => {
      mockFetch.mockResolvedValue(
        errorResponse(409, 'Version conflict', { serverVersion: 3 }),
      );
      const data = new Uint8Array([10, 20, 30]).buffer;

      try {
        await api.vault.putData(data, 1);
        expect.fail('Expected ApiError');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).status).toBe(409);
      }
    });
  });

  describe('getHistory', () => {
    it('returns array of version entries', async () => {
      const history = [
        {
          id: 'v1',
          version: 1,
          sizeBytes: 512,
          checksum: 'abc',
          createdAt: '2026-02-14T00:00:00.000Z',
        },
        {
          id: 'v2',
          version: 2,
          sizeBytes: 1024,
          checksum: 'def',
          createdAt: '2026-02-15T00:00:00.000Z',
        },
      ];
      mockFetch.mockResolvedValue(jsonResponse(history));

      const result = await api.vault.getHistory();

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/vault/history');
      expect(result).toEqual(history);
    });
  });
});

// =============================================================================
// ApiError
// =============================================================================

describe('ApiError', () => {
  it('has name, message, status, and data fields', () => {
    const error = new ApiError('Not found', 404, { detail: 'gone' });
    expect(error.name).toBe('ApiError');
    expect(error.message).toBe('Not found');
    expect(error.status).toBe(404);
    expect(error.data).toEqual({ detail: 'gone' });
  });

  it('is instanceof Error', () => {
    const error = new ApiError('fail', 500);
    expect(error).toBeInstanceOf(Error);
  });
});
