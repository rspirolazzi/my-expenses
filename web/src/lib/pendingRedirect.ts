import { safeCallbackUrl } from "./safeCallbackUrl";

// Where to go after flows that pass through several pages (sign-up → verify → currency, or a
// code sign-in), so an invitation link opened without a session is not lost (FR-009).
const KEY = "chepagame.pendingRedirect";

export function savePendingRedirect(url: string | null | undefined): void {
  if (!url) return;
  const safe = safeCallbackUrl(url, "");
  if (!safe) return;
  try {
    window.sessionStorage.setItem(KEY, safe);
  } catch {
    // Storage may be unavailable; the user simply lands on the default page.
  }
}

/** Returns the saved destination once (then forgets it), or the fallback. */
export function takePendingRedirect(fallback: string): string {
  try {
    const value = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return value ? safeCallbackUrl(value, fallback) : fallback;
  } catch {
    return fallback;
  }
}

/** Appends `callbackUrl` to an internal link when there is one to keep. */
export function withCallback(href: string, callbackUrl: string | null | undefined): string {
  const safe = callbackUrl ? safeCallbackUrl(callbackUrl, "") : "";
  return safe ? `${href}?callbackUrl=${encodeURIComponent(safe)}` : href;
}
