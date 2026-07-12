'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, tokenStore, Tokens } from '@/lib/api';
import { Locale, translate, TranslationKey } from '@/lib/i18n';

// ------------------------------------------------------------------
// Auth
// ------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  role: 'USER' | 'THERAPIST' | 'CORPORATE_ADMIN' | 'ADMIN' | 'SUPER_ADMIN';
  emailVerified: boolean;
  planTier?: 'FREE' | 'PREMIUM' | 'CORPORATE';
  profile?: { firstName: string; lastName: string; avatarUrl?: string | null };
  orgMemberships?: Array<{ isAdmin: boolean; organization: { id: string; name: string; slug: string } }>;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (tokens: Tokens) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  refresh: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ------------------------------------------------------------------
// Theme
// ------------------------------------------------------------------

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'system', setTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);
}

// ------------------------------------------------------------------
// Locale
// ------------------------------------------------------------------

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

export function useLocale() {
  return useContext(LocaleContext);
}

// ------------------------------------------------------------------
// Combined provider
// ------------------------------------------------------------------

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<Theme>('system');
  const [locale, setLocaleState] = useState<Locale>('en');

  const loadUser = useCallback(async () => {
    if (!tokenStore.access && !tokenStore.refresh) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<AuthUser>('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedTheme = (localStorage.getItem('akili.theme') as Theme) ?? 'system';
    const storedLocale = (localStorage.getItem('akili.locale') as Locale) ?? 'en';
    setThemeState(storedTheme);
    setLocaleState(storedLocale);
    applyTheme(storedTheme);
    void loadUser();
  }, [loadUser]);

  const signIn = useCallback(
    async (tokens: Tokens) => {
      tokenStore.set(tokens);
      setLoading(true);
      await loadUser();
    },
    [loadUser],
  );

  const signOut = useCallback(async () => {
    const refreshToken = tokenStore.refresh;
    if (refreshToken) {
      await api('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }).catch(() => undefined);
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem('akili.theme', next);
    applyTheme(next);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem('akili.locale', next);
  }, []);

  const authValue = useMemo(
    () => ({ user, loading, signIn, signOut, refresh: loadUser }),
    [user, loading, signIn, signOut, loadUser],
  );
  const themeValue = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  const localeValue = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: TranslationKey) => translate(locale, key),
    }),
    [locale, setLocale],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <ThemeContext.Provider value={themeValue}>
          <LocaleContext.Provider value={localeValue}>{children}</LocaleContext.Provider>
        </ThemeContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
