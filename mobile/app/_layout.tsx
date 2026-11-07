import "../src/i18n";

import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { PaperProvider } from "react-native-paper";

import { AuthProvider, useAuth } from "../src/hooks/useAuth";
import { usePendingInvite } from "../src/hooks/usePendingInvite";
import { useAppTheme } from "../src/theme";

function RootNavigator() {
  const { status, user, sessionExpired } = useAuth();
  const theme = useAppTheme(user?.preferences.theme);
  const pathname = usePathname();
  const router = useRouter();
  const returnTo = useRef<string | null>(null);
  usePendingInvite();

  // Edge case: the session expires while the app is in use. Remember the screen and come back
  // to it after signing in again.
  useEffect(() => {
    if (sessionExpired && pathname && !returnTo.current) returnTo.current = pathname;
  }, [sessionExpired, pathname]);

  useEffect(() => {
    if (status === "authenticated" && returnTo.current) {
      const target = returnTo.current;
      returnTo.current = null;
      router.replace(target as never);
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <PaperProvider theme={theme}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.background,
          }}
        >
          <ActivityIndicator />
        </View>
      </PaperProvider>
    );
  }

  const signedIn = status === "authenticated";
  return (
    <PaperProvider theme={theme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        {/* Invitation deep link: reachable with and without a session. */}
        <Stack.Screen name="invite/[code]" />
      </Stack>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
