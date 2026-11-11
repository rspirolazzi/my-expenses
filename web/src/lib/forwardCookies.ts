/**
 * Auth.js refreshes the backend tokens in the proxy and writes the new session cookie only to
 * the response. The page rendered for that same request still reads the old cookie, so its
 * backend calls go out with the expired access token and get 401. These helpers copy the cookies
 * the proxy is setting into the request headers that the page will see.
 */

interface CookieChange {
  name: string;
  value: string;
  deleted: boolean;
}

export function parseSetCookie(header: string): CookieChange | null {
  const [pair, ...attributes] = header.split(";");
  const index = pair.indexOf("=");
  if (index <= 0) return null;
  const name = pair.slice(0, index).trim();
  const value = pair.slice(index + 1).trim();
  const deleted = attributes.some((attribute) => {
    const [key, raw = ""] = attribute.split("=");
    const lower = key.trim().toLowerCase();
    if (lower === "max-age") return Number(raw.trim()) <= 0;
    if (lower === "expires") return Date.parse(raw.trim()) <= Date.now();
    return false;
  });
  return { name, value, deleted };
}

/** The request's Cookie header with the response's Set-Cookie changes applied. */
export function mergeCookieHeader(cookieHeader: string | null, setCookies: string[]): string {
  const cookies = new Map<string, string>();
  for (const part of (cookieHeader ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    cookies.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  for (const header of setCookies) {
    const change = parseSetCookie(header);
    if (!change) continue;
    if (change.deleted) cookies.delete(change.name);
    else cookies.set(change.name, change.value);
  }
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}
