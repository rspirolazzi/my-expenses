/**
 * A random UUID v4 for `clientRequestId`. Hermes has no `crypto.randomUUID`; uniqueness, not
 * secrecy, is what matters here (a retry reuses the same id).
 */
export function newRequestId(): string {
  const random = () => Math.random().toString(16).slice(2, 10).padEnd(8, "0");
  const hex = `${random()}${random()}${random()}${random()}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
