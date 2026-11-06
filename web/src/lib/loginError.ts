import type { ApiErrorCode } from "./api/errors";

const KNOWN: readonly ApiErrorCode[] = [
  "google_email_not_verified",
  "invalid_google_token",
  "internal_error",
  "network_error",
];

/** Translation key for the `?error=` that Auth.js or our Google callback puts on /login. */
export function loginErrorKey(error: string | undefined): string | null {
  if (!error) return null;
  // Auth.js reports a cancelled Google consent as AccessDenied / OAuthCallbackError.
  if (["AccessDenied", "OAuthCallbackError", "OAuthSignin", "Callback"].includes(error)) {
    return "auth.google.cancelled";
  }
  if ((KNOWN as readonly string[]).includes(error)) return `errors.${error}`;
  return "errors.internal_error";
}
