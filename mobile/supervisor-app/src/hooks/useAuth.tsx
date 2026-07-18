import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getAccessToken,
  getStoredUser,
  type SupervisorUser,
} from '@/services/auth-store';
import { login as loginApi, logout as logoutApi } from '@/services/auth';

type AuthState = {
  ready: boolean;
  user: SupervisorUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SupervisorUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    const [t, u] = await Promise.all([getAccessToken(), getStoredUser()]);
    setToken(t);
    setUser(u);
  }, []);

  useEffect(() => {
    void (async () => {
      await refreshSession();
      setReady(true);
    })();
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await loginApi(email, password);
    const t = await getAccessToken();
    setUser(u);
    setToken(t);
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({ ready, user, token, login, logout, refreshSession }),
    [ready, user, token, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
