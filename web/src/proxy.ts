import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { mergeCookieHeader } from "@/lib/forwardCookies";

const PRIVATE_PREFIXES = ["/dashboard", "/profile", "/onboarding", "/accounts", "/invite", "/join"];
const AUTH_PAGES = ["/login", "/register", "/verify-email", "/login-code", "/forgot-password"];
const ONBOARDING = "/onboarding/currency";

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Next.js 16 proxy (formerly middleware). Running `auth` here also refreshes the backend tokens
 * and persists the updated session cookie before any page renders.
 */
const authProxy = auth((request) => {
  const { pathname, search } = request.nextUrl;
  const session = request.auth;
  const signedIn = Boolean(session?.user) && !session?.error;

  if (matches(pathname, PRIVATE_PREFIXES) && !signedIn) {
    const url = new URL("/login", request.nextUrl);
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (signedIn) {
    const needsCurrency = session?.user.preferences.defaultCurrency == null;
    if (
      needsCurrency &&
      pathname !== ONBOARDING &&
      matches(pathname, [...PRIVATE_PREFIXES, ...AUTH_PAGES])
    ) {
      return NextResponse.redirect(new URL(ONBOARDING, request.nextUrl));
    }
    if (!needsCurrency && (matches(pathname, AUTH_PAGES) || pathname === ONBOARDING)) {
      return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
    }
  }
  return NextResponse.next();
});

type AuthProxyContext = Parameters<typeof authProxy>[1];

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const response = await authProxy(request, event as unknown as AuthProxyContext);
  if (!(response instanceof Response)) return response;
  const setCookies = response.headers.getSetCookie();
  // Only a page that will render (not a redirect) needs the refreshed cookie in its request.
  if (response.headers.get("x-middleware-next") !== "1" || setCookies.length === 0) {
    return response;
  }
  const headers = new Headers(request.headers);
  headers.set("cookie", mergeCookieHeader(request.headers.get("cookie"), setCookies));
  const forwarded = NextResponse.next({ request: { headers } });
  for (const cookie of setCookies) forwarded.headers.append("set-cookie", cookie);
  return forwarded;
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
