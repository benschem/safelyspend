import { useState, useEffect, useCallback } from 'react';
import { api, type AuthUser } from '@/lib/api-client';
import { STORAGE_KEYS } from '@/lib/storage-keys';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface UseAuthReturn {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  login: (email: string) => Promise<void>;
  verify: (email: string, code: string) => Promise<{ isNewUser: boolean }>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  checkAuth: () => Promise<void>;
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

  const verify = useCallback(async (email: string, code: string) => {
    // Check if vault exists before verifying to determine new vs returning user
    const { user: authUser } = await api.auth.verify(email, code);
    setUser(authUser);
    setStatus('authenticated');

    // Check if this user has an existing vault
    try {
      const metadata = await api.vault.getMetadata();
      return { isNewUser: metadata.version === 0 };
    } catch {
      return { isNewUser: true };
    }
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
    setStatus('unauthenticated');
    // Clear sync-related localStorage
    localStorage.removeItem(STORAGE_KEYS.SYNC_LOCAL_VERSION);
    localStorage.removeItem(STORAGE_KEYS.SYNC_LAST_SYNCED_AT);
  }, []);

  const deleteAccount = useCallback(async () => {
    await api.auth.deleteAccount();
    setUser(null);
    setStatus('unauthenticated');
    // Clear sync-related localStorage
    localStorage.removeItem(STORAGE_KEYS.SYNC_LOCAL_VERSION);
    localStorage.removeItem(STORAGE_KEYS.SYNC_LAST_SYNCED_AT);
  }, []);

  return {
    user,
    status,
    isAuthenticated: status === 'authenticated',
    login,
    verify,
    logout,
    deleteAccount,
    checkAuth,
  };
}
