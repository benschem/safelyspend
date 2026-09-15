const API_URL =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'https://api.safelyspend.app';

class ApiError extends Error {
  status: number;
  data?: Record<string, unknown>;

  constructor(message: string, status: number, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (data) this.data = data;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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

async function requestRaw(path: string, options: RequestInit = {}): Promise<Response> {
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

export interface Household {
  id: string;
  name: string;
}

/**
 * The KDF metadata columns that travel beside every wrapped blob. Shapes below
 * mirror the built worker (`services/key-bundle.ts`, `services/users.ts`,
 * `services/households.ts`) rather than the Phase 2 design doc — section 13 of
 * that doc lists where the two diverged.
 *
 * `kekSalt` and `kekKdfParams` are null or empty depending on the kind, not
 * interchangeably: a `pwd` row carries a 16-byte salt and 9 Argon2id parameter
 * bytes, a `recovery` row carries a null salt and an empty parameter string,
 * and an `ecies` row carries nulls throughout.
 */
/**
 * Which KEK a wrapped row opens under. Mirrors the worker's own `KekKind`
 * (`worker/src/lib/key-material.ts`); the client needs only the union, not the
 * runtime `KEK_KINDS` array the worker validates against.
 */
export type KekKind = 'pwd' | 'recovery' | 'ecies';

interface WrappedKeyMetadata {
  kekKind: KekKind;
  kekSalt: string | null;
  kekKdfKind: number | null;
  kekKdfParams: string | null;
}

/** One `user_keys` row: an X25519 private key wrapped under one KEK. */
export interface UserKeyRow extends WrappedKeyMetadata {
  wrappedPrivKey: string;
}

/** One `household_member_keys` row: the household MasterKey wrapped under one KEK. */
export interface MemberKeyRow extends WrappedKeyMetadata {
  wrappedMasterKey: string;
  /** Set only on an `ecies` row — the member who authored the handoff wrap. */
  senderUserId: string | null;
  senderPubkey: string | null;
}

/** Everything a client needs to unlock locally. Every blob in it is opaque to the server. */
export interface KeyBundle {
  user: {
    id: string;
    pubkey: string | null;
    verifierSalt: string | null;
    verifierKdfKind: number | null;
    verifierKdfParams: string | null;
  };
  userKeys: UserKeyRow[];
  /** Null for an invitee whose handoff has not completed: a real account with no household. */
  household: Household | null;
  /** The pwd and recovery pair once provisioned, or a lone transient `ecies` row. */
  memberKeys: MemberKeyRow[];
}

/**
 * What `/auth/verify-otp` hands back.
 *
 * `verifierSalt === null` means this account has requested a code but never
 * completed signup. That is not an error — it is how the client knows to route
 * itself to the signup branch rather than to login completion
 * (`getVerifierChallenge` in `worker/src/services/users.ts`).
 */
export interface OtpChallenge {
  authPendingToken: string;
  verifierSalt: string | null;
  verifierKdfKind: number | null;
  verifierKdfParams: string | null;
}

export interface SessionResponse {
  user: AuthUser;
  household: Household | null;
  keyBundle: KeyBundle;
}

/** The identity half of a signup body: the password proof and how it was derived. */
export interface VerifierFields {
  verifierCandidate: string;
  verifierSalt: string;
  verifierKdfKind: number;
  verifierKdfParams: string;
}

/**
 * The KDF metadata a `pwd` row carries. Narrower than `WrappedKeyMetadata`:
 * none of these three is ever null on a password row, and an upload has no
 * reason to describe the shapes it cannot send.
 */
interface PasswordKeyMetadata {
  kekSalt: string;
  kekKdfKind: number;
  kekKdfParams: string;
}

/**
 * What `/auth/recovery-reset` takes: a new password proof and the two rows it
 * wraps, swapped in for the old ones.
 *
 * No `kekKind` on either row. The worker imposes `'pwd'` rather than reading it
 * (`parsePasswordKey` in `worker/src/lib/key-material.ts`), so a client cannot
 * label a row `'recovery'` and overwrite the phrase it just used to get here.
 * The recovery rows survive a reset untouched, so the phrase keeps working.
 */
export interface RecoveryResetBody {
  newVerifier: VerifierFields;
  newUserKeyPwd: PasswordKeyMetadata & { wrappedPrivKey: string };
  newMemberKeyPwd: PasswordKeyMetadata & { wrappedMasterKey: string };
}

/** One open invite addressed to the email a signup just claimed. */
export interface PendingInvite {
  id: string;
  status: string;
  expiresAt: string;
}

/**
 * Signup returns a session plus any invites already waiting for this address.
 *
 * Phase 7 owns what to do with them. They cannot be accepted as things stand —
 * a signup creates a household, and `UNIQUE(household_members.user_id)` allows
 * only one (§13 of the Phase 2 design doc) — so nothing in v1 reads this field.
 */
export interface SignupResponse extends SessionResponse {
  pendingInvites: PendingInvite[];
}

/** The invitee has an account but no household yet: the handoff has not happened. */
export interface SignupWithInviteResponse {
  user: AuthUser;
  household: null;
  invite: { id: string; status: string; senderEmail: string; senderPubkey: string };
  keyBundle: KeyBundle;
}

export interface SignupBody extends VerifierFields {
  authPendingToken: string;
  pubkey: string;
  userKeys: UserKeyRow[];
  household: Household;
  memberKeys: MemberKeyRow[];
  rememberMe: boolean;
}

/**
 * Signing up against an invite differs in what it omits: no household block
 * (the invitee is joining one that exists) and no member keys (they have no
 * MasterKey yet — it arrives later through the handoff).
 */
export interface SignupWithInviteBody extends VerifierFields {
  authPendingToken: string;
  pubkey: string;
  userKeys: UserKeyRow[];
  inviteToken: string;
  rememberMe: boolean;
}

export const api = {
  auth: {
    login(email: string) {
      return request<{ message: string }>('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    verifyOtp(email: string, code: string) {
      return request<OtpChallenge>('/v1/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
    },

    /**
     * Spend the bridge token and prove the password. A mismatch consumes the
     * token anyway, by design (Phase 1 section 3.3) — the caller has to send
     * the user back for a fresh code rather than offer a second attempt.
     */
    loginComplete(authPendingToken: string, verifierCandidate: string, rememberMe: boolean) {
      return request<SessionResponse>('/v1/auth/login-complete', {
        method: 'POST',
        body: JSON.stringify({ authPendingToken, verifierCandidate, rememberMe }),
      });
    },

    /**
     * Spend the bridge token *without* a password proof, for someone who has
     * forgotten theirs. The same endpoint, and its own method rather than a
     * flag on the one above: this call sends no verifier, and an argument that
     * silently makes another argument meaningless is worse than two functions.
     *
     * What comes back is deliberately crippled. The session carries `rec`, and
     * `requireFullSession` (`worker/src/middleware/auth.ts`) lets it reach only
     * `/auth/key-bundle` and `/auth/recovery-reset` — it cannot push, pull, or
     * read `/auth/me`. The reset must also land within five minutes of this
     * call (`RECOVERY_SESSION_MAX_AGE_SECONDS`).
     *
     * The key bundle still arrives inline, which is the whole reason this is
     * one round trip: the caller unwraps the recovery rows from it directly.
     *
     * `rememberMe` is pinned false rather than exposed. A session that dies in
     * five minutes and is replaced by a real sign-in straight afterwards has
     * nothing to remember.
     */
    loginCompleteViaRecovery(authPendingToken: string) {
      return request<SessionResponse>('/v1/auth/login-complete', {
        method: 'POST',
        body: JSON.stringify({ authPendingToken, via: 'recovery', rememberMe: false }),
      });
    },

    /**
     * Swap the password rows and the verifier for ones derived from a new
     * password. Needs the recovery session above; an ordinary one is refused
     * with `RECOVERY_SESSION_REQUIRED`.
     *
     * Allowed once an hour per user, and the budget is spent on entry — the
     * `enforceSubjectRateLimit` call in the worker's `/recovery-reset` route
     * runs before the body is parsed, let alone written. So a retry after a
     * timeout is refused for the rest of the hour even though the first attempt
     * may well have landed. Treat a failure here as "find out whether the new
     * password works" rather than as something to send again.
     */
    recoveryReset(body: RecoveryResetBody) {
      return request<{ ok: true }>('/v1/auth/recovery-reset', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    signup(body: SignupBody) {
      return request<SignupResponse>('/v1/auth/signup', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    /**
     * **Unexercised.** Phase 7 is the only caller there will ever be, and it
     * has not been written, so nothing in `src/` invokes this and nothing has
     * run it against the live worker. It is here because the endpoint exists
     * and the shapes were settled alongside `signup`'s.
     *
     * The same argument that deleted `password-dialog.tsx`'s create mode
     * applies to it — code with no call site rots quietly — so treat the field
     * names below as transcribed from `worker/src/routes/auth.ts`, not as
     * verified. Phase 7 should check them before trusting them.
     */
    signupWithInvite(body: SignupWithInviteBody) {
      return request<SignupWithInviteResponse>('/v1/auth/signup-with-invite', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    /** The wrapped material for a local re-unlock against a session that is already live. */
    keyBundle() {
      return request<KeyBundle>('/v1/auth/key-bundle');
    },

    logout() {
      return request<{ message: string }>('/v1/auth/logout', {
        method: 'POST',
      });
    },

    me() {
      return request<{ user: AuthUser; household: Household | null }>('/v1/auth/me');
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
