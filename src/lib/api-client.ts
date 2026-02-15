const API_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'https://api.safelyspend.app';

class ApiError extends Error {
  status: number;
  data?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (data) this.data = data;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      (body as { error?: string }).error ?? response.statusText,
      response.status,
      body as Record<string, unknown>,
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function requestRaw(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.headers.get('content-type')?.includes('application/json')) {
      const body = await response.json().catch(() => ({}));
      throw new ApiError(
        (body as { error?: string }).error ?? response.statusText,
        response.status,
        body as Record<string, unknown>,
      );
    }
    throw new ApiError(response.statusText, response.status);
  }

  return response;
}

export interface AuthUser {
  id: string;
  email: string;
}

export const api = {
  auth: {
    login(email: string) {
      return request<{ message: string }>('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    verify(email: string, code: string, rememberMe?: boolean) {
      return request<{ user: AuthUser }>('/v1/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code, rememberMe }),
      });
    },

    logout() {
      return request<{ message: string }>('/v1/auth/logout', {
        method: 'POST',
      });
    },

    me() {
      return request<{ user: AuthUser }>('/v1/auth/me');
    },

    deleteAccount() {
      return request<{ message: string }>('/v1/auth/account', {
        method: 'DELETE',
      });
    },

    sessions() {
      return request<{
        sessions: Array<{ id: string; createdAt: string; isCurrent: boolean }>;
      }>('/v1/auth/sessions');
    },

    revokeSession(sessionId: string) {
      return request<{ message: string }>(`/v1/auth/sessions/${sessionId}`, {
        method: 'DELETE',
      });
    },

    revokeAllSessions() {
      return request<{ revoked: number }>('/v1/auth/revoke-all-sessions', {
        method: 'POST',
      });
    },
  },

  vault: {
    getMetadata() {
      return request<{
        version: number;
        sizeBytes?: number;
        checksum?: string;
        updatedAt?: string;
      }>('/v1/vault');
    },

    async getData(): Promise<{ data: ArrayBuffer; version: number }> {
      const response = await requestRaw('/v1/vault/data');
      const version = parseInt(response.headers.get('X-Vault-Version') ?? '0', 10);
      const data = await response.arrayBuffer();
      return { data, version };
    },

    async putData(
      data: ArrayBuffer,
      expectedVersion: number,
    ): Promise<{ version: number; vaultId: string }> {
      const response = await fetch(`${API_URL}/v1/vault/data`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Expected-Version': String(expectedVersion),
        },
        body: data,
      });

      const body = await response.json();

      if (!response.ok) {
        throw new ApiError(
          (body as { error?: string }).error ?? response.statusText,
          response.status,
          body as Record<string, unknown>,
        );
      }

      return body as { version: number; vaultId: string };
    },

    getHistory() {
      return request<
        Array<{
          id: string;
          version: number;
          sizeBytes: number;
          checksum: string;
          createdAt: string;
        }>
      >('/v1/vault/history');
    },

    async getDataByVaultId(vaultId: string): Promise<{ data: ArrayBuffer; version: number }> {
      const response = await requestRaw(`/v1/vault/data/${vaultId}`);
      const version = parseInt(response.headers.get('X-Vault-Version') ?? '0', 10);
      const data = await response.arrayBuffer();
      return { data, version };
    },
  },
} as const;

export { ApiError };
