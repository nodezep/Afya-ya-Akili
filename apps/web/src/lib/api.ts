'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const ACCESS_KEY = 'akili.accessToken';
const REFRESH_KEY = 'akili.refreshToken';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const tokenStore = {
  get access() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: { accessToken: string; refreshToken: string }) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = tokenStore.refresh;
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        tokenStore.clear();
        return false;
      }
      const json = await res.json();
      tokenStore.set(json.data);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * Fetch wrapper: attaches the bearer token, retries once after a 401 by
 * rotating the refresh token, unwraps the API's { success, data } envelope.
 */
export async function api<T = unknown>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const { skipAuth, ...init } = options;
  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string>),
    };
    const token = tokenStore.access;
    if (token && !skipAuth) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_URL}${path}`, { ...init, headers });
  };

  let res = await doFetch();
  if (res.status === 401 && !skipAuth && tokenStore.refresh) {
    const refreshed = await refreshTokens();
    if (refreshed) res = await doFetch();
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(json?.message)
      ? json.message.join(', ')
      : (json?.message ?? `Request failed (${res.status})`);
    throw new ApiError(res.status, message);
  }
  return (json?.data ?? json) as T;
}

/** Streams an SSE chat reply. Returns an abort function. */
export function streamChat(
  body: { content: string; conversationId?: string },
  handlers: {
    onStart?: (data: { conversationId: string }) => void;
    onDelta: (delta: string) => void;
    onDone?: (data: unknown) => void;
    onError?: (message: string) => void;
  },
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_URL}/chat/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenStore.access ?? ''}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null);
        handlers.onError?.(json?.message ?? 'Chat request failed');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const raw of events) {
          const eventMatch = raw.match(/^event: (.+)$/m);
          const dataMatch = raw.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;
          const data = JSON.parse(dataMatch[1]);
          switch (eventMatch[1]) {
            case 'start':
              handlers.onStart?.(data);
              break;
            case 'delta':
              handlers.onDelta(data.content);
              break;
            case 'done':
              handlers.onDone?.(data);
              break;
            case 'error':
              handlers.onError?.(data.message);
              break;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        handlers.onError?.((err as Error).message);
      }
    }
  })();

  return () => controller.abort();
}
