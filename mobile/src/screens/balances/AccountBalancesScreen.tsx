import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Chip, Text } from "react-native-paper";

import { AccountIcon } from "../../components/accounts/AccountBits";
import { AccountTabs } from "../../components/accounts/AccountTabs";
import { BalanceList } from "../../components/balances/BalanceList";
import { SettlementList } from "../../components/balances/SettlementList";
import { SuggestionList } from "../../components/balances/SuggestionList";
import { ErrorText } from "../../components/FormBits";
import { accountsApi } from "../../services/api/accounts";
import { settlementsApi } from "../../services/api/settlements";
import {
  type AccountBalances,
  type AccountResponse,
  type ApiErrorCode,
  errorCodeOf,
  type SettlementResponse,
} from "../../services/api/types";

function merge(existing: SettlementResponse[], page: SettlementResponse[]) {
  const seen = new Set(existing.map((item) => item.id));
  return [...existing, ...page.filter((item) => !seen.has(item.id))];
}

/**
 * "Saldos" tab: balances, then suggestions, then the settlements list (FR-000). It reloads when
 * the screen gets focus and on pull to refresh, never by itself (FR-025).
 */
export default function AccountBalancesScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const router = useRouter();
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [balances, setBalances] = useState<AccountBalances | null>(null);
  const [items, setItems] = useState<SettlementResponse[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const loadingMoreRef = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextAccount, nextBalances, page] = await Promise.all([
        accountsApi.get(accountId),
        settlementsApi.balances(accountId),
        settlementsApi.list(accountId),
      ]);
      setAccount(nextAccount);
      setBalances(nextBalances);
      setItems(page.items);
      setCursor(page.nextCursor);
    } catch (err) {
      const code = errorCodeOf(err);
      if (code === "not_found") router.replace("/accounts");
      else setError(code);
    }
  }, [accountId, router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function loadMore() {
    if (!cursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await settlementsApi.list(accountId, cursor);
      setItems((current) => merge(current, page.items));
      setCursor(page.nextCursor);
    } catch (err) {
      setError(errorCodeOf(err));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  if (!account || !balances) {
    return (
      <View style={styles.screen}>
        {error ? <ErrorText code={error} /> : <ActivityIndicator />}
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.row}>
        <AccountIcon icon={account.icon} size={36} />
        <Text variant="headlineSmall" style={styles.flex}>
          {account.name}
        </Text>
        {account.isClosed && <Chip compact>{t("accounts.closedBadge")}</Chip>}
      </View>
      <AccountTabs accountId={account.id} active="balances" />
      <ErrorText code={error} />
      <BalanceList
        balances={balances}
        locale={locale}
        onOpenExpenses={() =>
          router.replace({ pathname: "/accounts/[accountId]", params: { accountId: account.id } })
        }
      />
      <SuggestionList
        account={account}
        suggestions={balances.suggestions}
        locale={locale}
        onSaved={() => void load()}
      />
      {!account.isClosed && (
        <Button
          mode="contained"
          onPress={() =>
            router.push({
              pathname: "/accounts/[accountId]/settlements/new",
              params: { accountId: account.id },
            })
          }
        >
          {t("settlements.new")}
        </Button>
      )}
      <SettlementList
        account={account}
        items={items}
        locale={locale}
        hasMore={cursor !== null}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        onChanged={() => void load()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  flex: { flex: 1 },
});
