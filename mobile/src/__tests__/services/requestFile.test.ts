import { requestFile, setRequestLanguage } from "@/services/api/client";
import { exportsApi } from "@/services/api/exports";
import { saveTokens } from "@/services/auth/tokenStorage";

import { authResponse, jsonResponse } from "../support/render";

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const fresh = { ...authResponse.tokens, accessToken: "access-2", refreshToken: "refresh-2" };

function fileResponse(bytes: number[], headers: Record<string, string>) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  } as unknown as Response;
}

beforeEach(async () => {
  fetchMock.mockReset();
  setRequestLanguage("en");
  await saveTokens(authResponse.tokens);
});

it("downloads the bytes with the token, the language and the file name", async () => {
  fetchMock.mockResolvedValue(
    fileResponse([80, 75], {
      "content-type": "application/zip",
      "content-disposition":
        "attachment; filename=\"my-expenses_trip_2026-11-12.zip\"; filename*=UTF-8''my-expenses_trip_2026-11-12.zip",
    }),
  );
  const file = await exportsApi.account("a1", "csv");
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toMatch(/\/accounts\/a1\/export\?format=csv$/);
  expect(init.headers).toEqual({
    Authorization: "Bearer access",
    "X-Client": "mobile",
    "Accept-Language": "en",
  });
  expect(file).toEqual({
    bytes: new Uint8Array([80, 75]),
    fileName: "my-expenses_trip_2026-11-12.zip",
    mimeType: "application/zip",
  });
});

it("refreshes the token once on 401 and retries", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(401, { error: { code: "unauthorized" } }))
    .mockResolvedValueOnce(jsonResponse(200, fresh))
    .mockResolvedValueOnce(fileResponse([1], { "content-type": "application/json" }));
  const file = await exportsApi.mine("json");
  expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer access-2");
  expect(fetchMock.mock.calls[2][0]).toMatch(/\/users\/me\/export\?format=json$/);
  expect(file.fileName).toBe("export.json");
});

it("turns backend errors into ApiError", async () => {
  fetchMock.mockResolvedValue(jsonResponse(404, { error: { code: "not_found" } }));
  await expect(requestFile("/accounts/x/export?format=csv", "x.zip")).rejects.toMatchObject({
    status: 404,
    code: "not_found",
  });
});

it("reports a network error and never returns a partial file", async () => {
  fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
  await expect(exportsApi.mine("csv")).rejects.toMatchObject({ code: "network_error" });
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: { get: () => null },
    arrayBuffer: async () => {
      throw new TypeError("connection reset");
    },
  });
  await expect(exportsApi.mine("csv")).rejects.toMatchObject({ code: "network_error" });
});
