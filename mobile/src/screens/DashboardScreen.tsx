import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import { Button, Text } from "react-native-paper";

import { formStyles } from "../components/FormBits";
import { useAuth } from "../hooks/useAuth";
import { accountsApi } from "../services/api/accounts";
import type { AccountSummary } from "../services/api/types";
import { displayName } from "../utils/displayName";
import { AccountListItems } from "./accounts/AccountsScreen";

export default function DashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      accountsApi
        .list()
        .then((list) => active && setAccounts(list))
        .catch(() => active && setAccounts([]));
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ScrollView contentContainerStyle={formStyles.screen}>
      <Text variant="headlineMedium">
        {t("dashboard.title", { name: user ? displayName(user) : "" })}
      </Text>
      <Text variant="titleMedium">{t("accounts.recent")}</Text>
      {accounts && <AccountListItems accounts={accounts.slice(0, 5)} />}
      <Button mode="contained" onPress={() => router.push("/accounts/new")}>
        {t("accounts.new")}
      </Button>
      <Link href="/accounts">{t("accounts.seeAll")}</Link>
      <Link href="/profile">{t("nav.profile")}</Link>
    </ScrollView>
  );
}
