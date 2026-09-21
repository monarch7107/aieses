import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router';
import { ApiError, get, post } from './api';
import { useI18n } from './i18n';
import type { Role, User } from '@shared/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  demoLogin: (role: Role) => Promise<User>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { setLanguage } = useI18n();
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const res = await get<{ user: User }>('/auth/me');
        return res.user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    // Adopt the user's saved language preference on login unless the browser already has one stored.
    const user = meQuery.data;
    if (user && !localStorage.getItem('aieses.language')) setLanguage(user.language);
  }, [meQuery.data, setLanguage]);

  const setUser = useCallback(
    (user: User | null) => {
      qc.setQueryData(['me'], user);
      if (!user) qc.clear();
    },
    [qc],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      loading: meQuery.isLoading,
      demoLogin: async (role) => {
        const res = await post<{ user: User }>('/auth/demo-login', { role });
        setUser(res.user);
        return res.user;
      },
      login: async (email, password) => {
        const res = await post<{ user: User }>('/auth/login', { email, password });
        setUser(res.user);
        return res.user;
      },
      logout: async () => {
        await post('/auth/logout');
        setUser(null);
      },
      refresh: async () => {
        await qc.invalidateQueries({ queryKey: ['me'] });
      },
    }),
    [meQuery.data, meQuery.isLoading, qc, setUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function homeFor(role: Role): string {
  if (role === 'teacher') return '/teacher';
  if (role === 'admin') return '/admin';
  return '/';
}

/** Route guard: redirects unauthenticated users to /login and wrong roles to their home. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500" role="status" aria-live="polite">
        Loading AIESES…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}
