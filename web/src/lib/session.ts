import "server-only";

import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";

/**
 * Backend access token for the current request, read from the encrypted Auth.js cookie on the
 * server. It is never serialized into the session sent to the browser.
 */
export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const secureCookie = process.env.NODE_ENV === "production";
  const token = await getToken({
    req: { headers: new Headers({ cookie: cookieStore.toString() }) },
    secret: process.env.AUTH_SECRET,
    secureCookie,
  });
  return token?.accessToken;
}
