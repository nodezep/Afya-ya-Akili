import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:4000/api/v1';

const ACCESS_KEY = 'akili.accessToken';
const REFRESH_KEY = 'akili.refreshToken';

export const tokenStore = {
  async getAccess() {
    return SecureStore.getItemAsync(ACCESS_KEY);
  },
  async getRefresh() {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
  async set(tokens: { accessToken: string; refreshToken: string }) {
    await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
  },
  async clear() {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refreshToken = await tokenStore.getRefresh();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        await tokenStore.clear();
        return false;
      }
      const json = await res.json();
      await tokenStore.set(json.data);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/**
 * Fetch wrapper with bearer auth, one refresh retry, and an offline
 * read-through cache: successful GETs are cached in AsyncStorage and
 * served when the network is unavailable.
 */
export async function api<T = unknown>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const { skipAuth, ...init } = options;
  const method = (init.method ?? 'GET').toUpperCase();
  const cacheKey = `akili.cache:${path}`;

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string>),
    };
    if (!skipAuth) {
      const token = await tokenStore.getAccess();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`${API_URL}${path}`, { ...init, headers });
  };

  try {
    let res = await doFetch();
    if (res.status === 401 && !skipAuth) {
      const ok = await refreshTokens();
      if (ok) res = await doFetch();
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message = Array.isArray(json?.message)
        ? json.message.join(', ')
        : (json?.message ?? `Request failed (${res.status})`);
      throw new Error(message);
    }
    const data = (json?.data ?? json) as T;
    if (method === 'GET') {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(() => undefined);
    }
    return data;
  } catch (err) {
    // Offline fallback for reads
    if (method === 'GET') {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached) as T;
    }
    throw err;
  }
}
