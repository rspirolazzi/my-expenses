import { apiRequest, onSessionExpired, setRequestLanguage } from "@/services/api/client";
import { ApiError } from "@/services/api/types";
import { getTokens, saveTokens } from "@/services/auth/tokenStorage";

import { authResponse, jsonResponse } from "../support/render";

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const fresh = { ...authResponse.tokens, accessToken: "access-2", refreshToken: "refresh-2" };

beforeEach(async () => {
  fetchMock.mockReset();
  setRequestLanguage("en");
  await saveTokens(authResponse.tokens);
});

function headersOf(call: number): Record<string, string> {
  return fetchMock.mock.calls[call][1].headers;
}

it("sends the access token, X-Client and Accept-Language", async () => {
  fetchMock.mockResolvedValue(jsonResponse(200, { ok: 1 }));
  await apiRequest("/users/me", { authenticated: true });
  expect(headersOf(0)).toMatchObject({
    Authorization: "Bearer access",
    "X-Client": "mobile",
    "Accept-Language": "en",
  });
});

it("refreshes once on 401, stores the new pair and retries", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(401, { error: { code: "unauthorized" } }))
    .mockResolvedValueOnce(jsonResponse(200, fresh))
    .mockResolvedValueOnce(jsonResponse(200, { ok: 1 }));
  await expect(apiRequest("/users/me", { authenticated: true })).resolves.toEqual({ ok: 1 });
  expect(fetchMock.mock.calls[1][0]).toMatch(/\/auth\/refresh$/);
  expect(headersOf(2).Authorization).toBe("Bearer access-2");
  expect((await getTokens())?.refreshToken).toBe("refresh-2");
});

it("clears the tokens and reports the expired session when refresh fails", async () => {
  const listener = jest.fn();
  const unsubscribe = onSessionExpired(listener);
  fetchMock
    .mockResolvedValueOnce(jsonResponse(401, { error: { code: "unauthorized" } }))
    .mockResolvedValueOnce(jsonResponse(401, { error: { code: "invalid_refresh_token" } }));
  await expect(apiRequest("/users/me", { authenticated: true })).rejects.toMatchObject({
    code: "invalid_refresh_token",
  });
  expect(listener).toHaveBeenCalledTimes(1);
  expect(await getTokens()).toBeNull();
  unsubscribe();
});

it("shares a single refresh between concurrent 401s", async () => {
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    if (url.endsWith("/auth/refresh")) return jsonResponse(200, fresh);
    const auth = (init.headers as Record<string, string>).Authorization;
    return auth === "Bearer access-2"
      ? jsonResponse(200, { ok: 1 })
      : jsonResponse(401, { error: { code: "unauthorized" } });
  });
  await Promise.all([
    apiRequest("/users/me", { authenticated: true }),
    apiRequest("/users/me", { authenticated: true }),
  ]);
  const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
    String(url).endsWith("/auth/refresh"),
  );
  expect(refreshCalls).toHaveLength(1);
});

it("maps API errors with retryAfterSeconds", async () => {
  fetchMock.mockResolvedValue(
    jsonResponse(429, { error: { code: "rate_limited", retryAfterSeconds: 42 } }),
  );
  const error = await apiRequest("/auth/login-code", { method: "POST", body: {} }).catch((e) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 429, code: "rate_limited", retryAfterSeconds: 42 });
});
