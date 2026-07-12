import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api, tokenStore } from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  planTier?: string;
  profile?: { firstName: string; lastName: string; avatarUrl?: string | null };
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/** Registers this device for Expo push notifications with the API. */
async function registerForPush(): Promise<void> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const request = await Notifications.requestPermissionsAsync();
      status = request.status;
    }
    if (status !== 'granted') return;

    const token = await Notifications.getExpoPushTokenAsync();
    await api('/users/me/devices', {
      method: 'POST',
      body: JSON.stringify({
        expoPushToken: token.data,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      }),
    });
  } catch {
    // Push is best-effort; never block sign-in on it
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const refresh = await tokenStore.getRefresh();
    if (!refresh) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<AuthUser>('/auth/me');
      setUser(me);
      void registerForPush();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const signIn = useCallback(
    async (tokens: { accessToken: string; refreshToken: string }) => {
      await tokenStore.set(tokens);
      setLoading(true);
      await loadUser();
    },
    [loadUser],
  );

  const signOut = useCallback(async () => {
    const refreshToken = await tokenStore.getRefresh();
    if (refreshToken) {
      await api('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }).catch(() => undefined);
    }
    await tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
