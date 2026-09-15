import { useState, useEffect, useCallback } from 'react';
import { api, type AuthUser, type OtpChallenge } from '@/lib/api-client';
import { lockKeyVault } from '@/lib/key-vault';
import { STORAGE_KEYS } from '@/lib/storage-keys';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface UseAuthReturn {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  /** Send a one-time code. Find-or-create: an unknown email gets an inert account row. */
  login: (email: string) => Promise<void>;
  /**
   * Trade the code for a bridge token.
   *
   * A null `verifierSalt` on the result means this account never completed
   * signup, which is how the caller knows to route to the signup branch rather
   * than to login completion. It is an ordinary first-run state, not an error.
   */
  verifyOtp: (email: string, code: string) => Promise<OtpChallenge>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

/**
 * Forget that this device was ever synced.
 *
 * Both callers below need all three: the stored version and timestamp, which
 * describe a relationship with a server that has just ended, and the key vault,
 * which otherwise keeps `isVaultUnlocked()` true and leaves Settings claiming a
 * cloud connection that no longer exists.
 *
 * Q6 makes the JWT and the MasterKey independent *lifetimes* — a session
 * expiring does not lock the vault, and locking does not end the session. It
 * does not make an explicit logout leave decryption keys sitting in memory
 * with nothing left to decrypt against.
 */
function clearLocalSyncState(): void {
  lockKeyVault();
  localStorage.removeItem(STORAGE_KEYS.SYNC_LOCAL_VERSION);
  localStorage.removeItem(STORAGE_KEYS.SYNC_LAST_SYNCED_AT);
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const checkAuth = useCallback(async () => {
    try {
      const { user: authUser } = await api.auth.me();
      setUser(authUser);
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email: string) => {
    await api.auth.login(email);
  }, []);

  const verifyOtp = useCallback((email: string, code: string) => {
    // No session yet — the bridge token this returns is spent by whichever of
    // /auth/signup or /auth/login-complete the caller routes to.
    return api.auth.verifyOtp(email, code);
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
    setStatus('unauthenticated');
    clearLocalSyncState();
  }, []);

  const deleteAccount = useCallback(async () => {
    await api.auth.deleteAccount();
    setUser(null);
    setStatus('unauthenticated');
    // IndexedDB is untouched, so the budget survives as a local-only app.
    clearLocalSyncState();
  }, []);

  return {
    user,
    status,
    isAuthenticated: status === 'authenticated',
    login,
    verifyOtp,
    logout,
    deleteAccount,
    checkAuth,
  };
}
