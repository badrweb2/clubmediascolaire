import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AuthState, Category, PlatformSettings } from '../types.ts';

interface AppContextValue {
  pathname: string;
  searchParams: URLSearchParams;
  navigate: (to: string) => void;
  settings: PlatformSettings;
  categories: Category[];
  refreshPublicBootstrap: () => Promise<void>;
  auth: AuthState;
  token: string | null;
  setSession: (token: string, username: string, envManaged?: boolean) => void;
  clearSession: () => Promise<void>;
  refreshAuthStatus: () => Promise<void>;
  apiFetch: <T>(url: string, init?: RequestInit) => Promise<T>;
}

const DEFAULT_SETTINGS: PlatformSettings = {
  school_name: 'مدرسة الحسن الداخل',
  platform_title: 'المنصة التعليمية لمدرسة الحسن الداخل',
  platform_tagline:
    'معرض رقمي ومكتبة مدرسية تفاعلية لعرض وحفظ وتوثيق إنتاجات وإبداعات التلاميذ في العلوم والفنون والإذاعة والمشاريع التربوية.',
  hero_cover_url: '/src/assets/images/hero_school_cover_1795563098821.jpg',
  logo_url: '/assets/aistudio/LOGO_e619da1e.png',
  academic_year: '2026 / 2027',
  footer_note: 'جميع الحقوق محفوظة لمدرسة الحسن الداخل — معرض الإبداع الطلابي الرقمي',
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [locationUrl, setLocationUrl] = useState<string>(
    () => window.location.pathname + window.location.search
  );
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthState>({
    needsSetup: false,
    authenticated: false,
    username: null,
    envManaged: false,
  });

  useEffect(() => {
    const onPopState = () => {
      setLocationUrl(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    const current = window.location.pathname + window.location.search;
    if (to !== current) {
      window.history.pushState({}, '', to);
      setLocationUrl(to);
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const apiFetch = useCallback(
    async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
      const headers = new Headers(init.headers);
      if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await fetch(url, { ...init, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 && token) {
          setToken(null);
          setAuth((prev) => ({ ...prev, authenticated: false, username: null }));
        }
        throw new Error((data as { error?: string }).error || 'حدث خطأ أثناء الاتصال بالخادم.');
      }
      return data as T;
    },
    [token]
  );

  const refreshPublicBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/public/bootstrap');
      if (!res.ok) return;
      const data = (await res.json()) as {
        settings?: PlatformSettings;
        categories?: Category[];
      };
      if (data.settings) setSettings(data.settings);
      if (data.categories) setCategories(data.categories);
    } catch {
      // ignore transient network errors
    }
  }, []);

  const refreshAuthStatus = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/auth/status', { headers });
      if (!res.ok) return;
      const data = (await res.json()) as AuthState;
      setAuth(data);
      if (!data.authenticated && token) {
        setToken(null);
      }
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    refreshPublicBootstrap();
    refreshAuthStatus();
  }, [refreshPublicBootstrap, refreshAuthStatus]);

  const setSession = useCallback((nextToken: string, username: string, envManaged = false) => {
    setToken(nextToken);
    setAuth({
      needsSetup: false,
      authenticated: true,
      username,
      envManaged,
    });
  }, []);

  const clearSession = useCallback(async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore
      }
    }
    setToken(null);
    setAuth((prev) => ({
      ...prev,
      authenticated: false,
      username: null,
    }));
  }, [token]);

  const qIdx = locationUrl.indexOf('?');
  const pathname = qIdx === -1 ? locationUrl : locationUrl.slice(0, qIdx);
  const searchParams = new URLSearchParams(qIdx === -1 ? '' : locationUrl.slice(qIdx + 1));

  return (
    <AppContext.Provider
      value={{
        pathname,
        searchParams,
        navigate,
        settings,
        categories,
        refreshPublicBootstrap,
        auth,
        token,
        setSession,
        clearSession,
        refreshAuthStatus,
        apiFetch,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
