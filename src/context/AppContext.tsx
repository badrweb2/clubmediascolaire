import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AuthState, Category, PlatformSettings, PublicSiteStats } from '../types.ts';
import { DEFAULT_PLATFORM_SETTINGS } from '../lib/settingsDefaults.ts';

interface AppContextValue {
  pathname: string;
  searchParams: URLSearchParams;
  navigate: (to: string) => void;
  lastPublicRoute: string | null;
  settings: PlatformSettings;
  categories: Category[];
  siteStats: PublicSiteStats;
  refreshPublicBootstrap: () => Promise<void>;
  auth: AuthState;
  token: string | null;
  setSession: (token: string, username: string, envManaged?: boolean) => void;
  clearSession: () => Promise<void>;
  refreshAuthStatus: () => Promise<void>;
  apiFetch: <T>(url: string, init?: RequestInit) => Promise<T>;
}

const DEFAULT_SITE_STATS: PublicSiteStats = {
  total_site_visits: 0,
  today_site_visits: 0,
  unique_visitors: 0,
  total_work_views: 0,
};

const AppContext = createContext<AppContextValue | null>(null);

function getOrCreateVisitorId(): string {
  try {
    const existing = window.localStorage.getItem('alhassan_visitor_id');
    if (existing) return existing;
    const next =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem('alhassan_visitor_id', next);
    return next;
  } catch {
    return `v-${Date.now()}`;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [locationUrl, setLocationUrl] = useState<string>(
    () => window.location.pathname + window.location.search
  );
  const [lastPublicRoute, setLastPublicRoute] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem('alhassan_last_public_route');
    } catch {
      return null;
    }
  });
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [siteStats, setSiteStats] = useState<PublicSiteStats>(DEFAULT_SITE_STATS);
  const [token, setToken] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthState>({
    needsSetup: false,
    authenticated: false,
    username: null,
    envManaged: false,
  });
  const visitSentRef = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      setLocationUrl(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    const current = window.location.pathname + window.location.search;
    if (
      !window.location.pathname.startsWith('/admin') &&
      !window.location.pathname.startsWith('/work/')
    ) {
      setLastPublicRoute(current);
      try {
        window.sessionStorage.setItem('alhassan_last_public_route', current);
      } catch {
        // ignore
      }
    }
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
        siteStats?: PublicSiteStats;
      };
      if (data.settings) setSettings(data.settings);
      if (data.categories) setCategories(data.categories);
      if (data.siteStats) setSiteStats(data.siteStats);
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

  // Record 1 real visit per browser session on public pages
  useEffect(() => {
    if (visitSentRef.current) return;
    if (window.location.pathname.startsWith('/admin')) return;

    let alreadySent = false;
    try {
      alreadySent = window.sessionStorage.getItem('alhassan_session_visit_sent') === '1';
    } catch {
      alreadySent = false;
    }
    if (alreadySent) {
      visitSentRef.current = true;
      return;
    }

    visitSentRef.current = true;
    try {
      window.sessionStorage.setItem('alhassan_session_visit_sent', '1');
    } catch {
      // ignore
    }

    const visitorId = getOrCreateVisitorId();
    fetch('/api/public/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: window.location.pathname || '/',
        visitor_id: visitorId,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { siteStats?: PublicSiteStats } | null) => {
        if (data?.siteStats) {
          setSiteStats(data.siteStats);
        }
      })
      .catch(() => {
        // ignore transient network error
      });
  }, []);

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
        lastPublicRoute,
        settings,
        categories,
        siteStats,
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
