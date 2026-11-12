import "server-only";

import { getLocale } from "next-intl/server";

import { baseUrl } from "@/lib/api/client";
import { getAccessToken } from "@/lib/session";

function errorResponse(status: number, code: string): Response {
  return Response.json({ error: { code } }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Forwards an export request to the backend and streams the file back (research R12). The
 * backend token is read on the server and never reaches the browser. The file language is the
 * user's (profile first, like every page), never the browser's own Accept-Language (FR-010).
 */
export async function forwardExport(backendPath: string, request: Request): Promise<Response> {
  const accessToken = await getAccessToken();
  if (!accessToken) return errorResponse(401, "unauthorized");
  const format = new URL(request.url).searchParams.get("format") ?? "";
  const language = await getLocale();

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl()}${backendPath}?format=${encodeURIComponent(format)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Accept-Language": language,
        "X-Client": "web",
      },
      cache: "no-store",
    });
  } catch {
    return errorResponse(502, "network_error");
  }

  if (!upstream.ok) {
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of ["Content-Type", "Content-Disposition"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: 200, headers });
}
