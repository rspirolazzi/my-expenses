import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../src/hooks/useAuth";

/** A user without a default currency only sees the onboarding (FR-020a). */
export default function AppLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const needsCurrency = user?.preferences.defaultCurrency == null;

  return (
    <Stack>
      <Stack.Protected guard={needsCurrency}>
        <Stack.Screen name="onboarding-currency" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!needsCurrency}>
        <Stack.Screen name="index" options={{ title: t("common.appName") }} />
        <Stack.Screen name="profile" options={{ title: t("nav.profile") }} />
        <Stack.Screen name="accounts/index" options={{ title: t("accounts.title") }} />
        <Stack.Screen name="accounts/new" options={{ title: t("accounts.new") }} />
        <Stack.Screen name="accounts/[accountId]/index" options={{ title: t("expenses.title") }} />
        <Stack.Screen
          name="accounts/[accountId]/settings"
          options={{ title: t("expenses.settings") }}
        />
        <Stack.Screen
          name="accounts/[accountId]/expenses/new"
          options={{ title: t("expenses.form.newTitle") }}
        />
        <Stack.Screen
          name="accounts/[accountId]/expenses/[expenseId]/index"
          options={{ title: "" }}
        />
        <Stack.Screen
          name="accounts/[accountId]/expenses/[expenseId]/edit"
          options={{ title: t("expenses.form.editTitle") }}
        />
        <Stack.Screen name="join" options={{ title: t("accounts.join") }} />
      </Stack.Protected>
    </Stack>
  );
}
