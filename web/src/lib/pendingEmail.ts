// The email being verified is kept in sessionStorage instead of the URL, so it does not end up in
// browser history or server logs.
const KEY = "chepagame.pendingEmail";

export function savePendingEmail(email: string): void {
  try {
    window.sessionStorage.setItem(KEY, email);
  } catch {
    // Storage may be unavailable (private mode); the flow still works within the page.
  }
}

export function readPendingEmail(): string {
  try {
    return window.sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

const noopSubscribe = () => () => undefined;

/** Arguments for useSyncExternalStore: the stored email on the client, "" on the server. */
export const pendingEmailStore = [noopSubscribe, readPendingEmail, () => ""] as const;
