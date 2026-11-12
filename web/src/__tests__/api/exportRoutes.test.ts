/**
 * @jest-environment node
 */
import { POST as exportAccount } from "@/app/api/exports/accounts/[accountId]/route";
import { POST as exportMine } from "@/app/api/exports/me/route";
import { getAccessToken } from "@/lib/session";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/session", () => ({ getAccessToken: jest.fn() }));
// The language next-intl resolved for the user: their profile first (FR-010).
jest.mock("next-intl/server", () => ({ getLocale: jest.fn(async () => "en") }));

const token = getAccessToken as jest.Mock;
const fetchMock = jest.fn();

function context(accountId: string) {
  return { params: Promise.resolve({ accountId }) };
}

function request(url: string, acceptLanguage = "es-AR,es;q=0.9") {
  return new Request(url, { method: "POST", headers: { "Accept-Language": acceptLanguage } });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.API_INTERNAL_BASE_URL = "http://backend:8000/api/v1";
  global.fetch = fetchMock as unknown as typeof fetch;
  token.mockResolvedValue("access-token");
});

it("answers 401 without a session and never calls the backend", async () => {
  token.mockResolvedValue(undefined);
  const response = await exportAccount(
    request("http://web/api/exports/accounts/a1?format=csv"),
    context("a1"),
  );
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: { code: "unauthorized" } });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("forwards the file with the user's language, not the browser's", async () => {
  fetchMock.mockResolvedValue(
    new Response(new Uint8Array([80, 75, 3, 4]), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="chepagame_trip_2026-11-12.zip"',
        "X-Internal": "secret",
      },
    }),
  );
  const response = await exportAccount(
    request("http://web/api/exports/accounts/a%2F1?format=csv"),
    context("a/1"),
  );
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("http://backend:8000/api/v1/accounts/a%2F1/export?format=csv");
  expect(init.headers).toEqual({
    Authorization: "Bearer access-token",
    "Accept-Language": "en",
    "X-Client": "web",
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/zip");
  expect(response.headers.get("content-disposition")).toBe(
    'attachment; filename="chepagame_trip_2026-11-12.zip"',
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-internal")).toBeNull();
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([80, 75, 3, 4]));
});

it("propagates backend errors with their status and body", async () => {
  fetchMock.mockResolvedValue(
    Response.json({ error: { code: "not_found", message: "No existe." } }, { status: 404 }),
  );
  const response = await exportAccount(
    request("http://web/api/exports/accounts/a1?format=json"),
    context("a1"),
  );
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: { code: "not_found", message: "No existe." } });
});

it("reports a network error when the backend is down", async () => {
  fetchMock.mockRejectedValue(new TypeError("fetch failed"));
  const response = await exportMine(request("http://web/api/exports/me?format=json"));
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: { code: "network_error" } });
});

it("exports all my data from the profile endpoint", async () => {
  fetchMock.mockResolvedValue(
    new Response("{}", {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="chepagame_2026-11-12.json"',
      },
    }),
  );
  const response = await exportMine(request("http://web/api/exports/me?format=json"));
  expect(fetchMock.mock.calls[0][0]).toBe("http://backend:8000/api/v1/users/me/export?format=json");
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
});
