import { clearTokens, getTokens, saveTokens } from "../auth/tokenStorage";

import { ApiError, type ApiErrorCode, type TokenPair } from "./types";

type Method = "GET" | "POST" | "PATCH";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  /** Send the access token (and refresh it once on 401). */
  authenticated?: boolean;
}

const expiredListeners = new Set<() => void>();
let language = "es";
let refreshing: Promise<TokenPair | null> | null = null;

export function baseUrl(): string {
  return (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(
    /\/$/,
    "",
  );
}

export function setRequestLanguage(value: string): void {
  language = value;
}

/** Fired when the refresh token is no longer valid: the user must sign in again. */
export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

async function send(path: string, options: RequestOptions, accessToken?: string) {
  const headers: Record<string, string> = {
    "X-Client": "mobile",
    "Accept-Language": language,
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(`${baseUrl()}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "network_error");
  }
}

/** One refresh at a time: concurrent 401s share the same request. */
function refreshOnce(refreshToken: string): Promise<TokenPair | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const response = await send("/auth/refresh", { method: "POST", body: { refreshToken } });
        if (!response.ok) return null;
        const tokens = (await response.json()) as TokenPair;
        await saveTokens(tokens);
        return tokens;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as {
    error?: { code?: string; retryAfterSeconds?: number };
  } | null;
  if (!response.ok) {
    const code = (payload?.error?.code ?? "internal_error") as ApiErrorCode;
    throw new ApiError(response.status, code, payload?.error?.retryAfterSeconds);
  }
  return payload as T;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const tokens = options.authenticated ? await getTokens() : null;
  let response = await send(path, options, tokens?.accessToken);

  if (response.status === 401 && options.authenticated && tokens) {
    const fresh = await refreshOnce(tokens.refreshToken);
    if (!fresh) {
      await clearTokens();
      expiredListeners.forEach((listener) => listener());
      throw new ApiError(401, "invalid_refresh_token");
    }
    response = await send(path, options, fresh.accessToken);
  }
  return parse<T>(response);
}
