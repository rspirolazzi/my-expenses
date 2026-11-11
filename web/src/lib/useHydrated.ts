import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * False on the server and during hydration, true afterwards. Values that depend on the browser
 * (ICU data, the device's time zone) must wait for it, or hydration fails and React re-renders
 * the whole page on the client.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
