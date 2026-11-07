import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { Button, Chip, List, Text } from "react-native-paper";

import { AccountIcon } from "../../components/accounts/AccountBits";
import { ErrorText, formStyles } from "../../components/FormBits";
import { accountsApi } from "../../services/api/accounts";
import { type AccountSummary, type ApiErrorCode, errorCodeOf } from "../../services/api/types";

/** Dates in the user's language (Principle II). */
export function formatDate(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(iso));
}

export function AccountListItems({ accounts }: { accounts: AccountSummary[] }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  if (accounts.length === 0) return <Text>{t("accounts.empty")}</Text>;
  return (
    <View>
      {accounts.map((account) => (
        <List.Item
          key={account.id}
          title={account.name}
          description={`${account.currency} · ${t("accounts.participantCount", {
            count: account.participantCount,
          })} · ${t("accounts.updatedAt", { date: formatDate(account.updatedAt, i18n.language) })}`}
          left={() => <AccountIcon icon={account.icon} />}
          right={() => (account.isClosed ? <Chip compact>{t("accounts.closedBadge")}</Chip> : null)}
          onPress={() =>
            router.push({ pathname: "/accounts/[accountId]", params: { accountId: account.id } })
          }
        />
      ))}
    </View>
  );
}

export default function AccountsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);
  const [error, setError] = useState<ApiErrorCode | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      accountsApi
        .list()
        .then((list) => active && setAccounts(list))
        .catch((err) => active && setError(errorCodeOf(err)));
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ScrollView contentContainerStyle={formStyles.screen}>
      <Text variant="headlineMedium">{t("accounts.title")}</Text>
      <Button mode="contained" onPress={() => router.push("/accounts/new")}>
        {t("accounts.new")}
      </Button>
      <Button mode="outlined" onPress={() => router.push("/join")}>
        {t("accounts.join")}
      </Button>
      <ErrorText code={error} />
      {accounts && <AccountListItems accounts={accounts} />}
    </ScrollView>
  );
}
