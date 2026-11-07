import { Redirect, useLocalSearchParams } from "expo-router";

import { useAuth } from "../../src/hooks/useAuth";
import { setPendingInvite } from "../../src/hooks/usePendingInvite";
import { InvitationScreen } from "../../src/screens/accounts/JoinScreens";

/**
 * Deep link myexpenses://invite/<code>, reachable with or without a session. Without one, the code
 * is remembered and the user goes to sign in; usePendingInvite opens it afterwards (FR-009).
 */
export default function InviteRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { status } = useAuth();
  if (status === "loading") return null;
  if (status !== "authenticated") {
    setPendingInvite(code);
    return <Redirect href="/login" />;
  }
  return <InvitationScreen code={code} />;
}
