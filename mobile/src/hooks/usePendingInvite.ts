import { useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "./useAuth";

// An invitation opened without a session (deep link) waits here until the user signs in.
let pendingCode: string | null = null;

export function setPendingInvite(code: string): void {
  pendingCode = code;
}

export function takePendingInvite(): string | null {
  const code = pendingCode;
  pendingCode = null;
  return code;
}

/** Opens the pending invitation as soon as the user is authenticated (FR-009). */
export function usePendingInvite(): void {
  const { status } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status !== "authenticated") return;
    const code = takePendingInvite();
    if (code) router.push({ pathname: "/invite/[code]", params: { code } });
  }, [status, router]);
}
