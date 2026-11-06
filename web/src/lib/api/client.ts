import "server-only";

import { ApiError, type ApiErrorCode } from "./errors";

type Method = "GET" | "POST" | "PATCH";

interface ApiFetchOptions {
  method?: Method;
  body?: unknown;
  accessToken?: string;
  language?: string;
}

function baseUrl(): string {
  const url = process.env.API_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) throw new Error("API_INTERNAL_BASE_URL is not configured");
  return url.replace(/\/$/, "");
}

/**
 * Server-side call to the FastAPI backend. Runs only on the Next.js server (BFF), so backend
 * tokens never reach the browser.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "X-Client": "web",
    "Accept-Language": options.language ?? "es",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "network_error");
  }

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
