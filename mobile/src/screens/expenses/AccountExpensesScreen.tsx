import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, SectionList, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Chip, Text } from "react-native-paper";

import { AccountIcon } from "../../components/accounts/AccountBits";
import { AccountTabs } from "../../components/accounts/AccountTabs";
import { ExportButton } from "../../components/exports/ExportButton";
import { ExpenseListItem } from "../../components/expenses/ExpenseBits";
import { ErrorText } from "../../components/FormBits";
import { exportsApi } from "../../services/api/exports";
import { accountsApi } from "../../services/api/accounts";
import { expensesApi } from "../../services/api/expenses";
import {
  type AccountResponse,
  type ApiErrorCode,
  errorCodeOf,
  type ExpenseListItem as Item,
} from "../../services/api/types";
import { formatDay, groupByDay, mergePages } from "../../utils/expenseGroups";
import { formatMoney } from "../../utils/money";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The account's main view: total on top and expenses grouped by day, 50 at a time (FR-034,
 * FR-035). It reloads when the screen gets focus and on pull to refresh, never by itself (FR-033).
 */
export default function AccountExpensesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = i18n.language;
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState("0");
  const [count, setCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const loadingMoreRef = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextAccount, page] = await Promise.all([
        accountsApi.get(accountId),
        expensesApi.list(accountId),
      ]);
      setAccount(nextAccount);
      setItems(page.items);
      setCursor(page.nextCursor);
      setTotal(page.total ?? "0");
      setCount(page.count ?? 0);
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
      const page = await expensesApi.list(accountId, cursor);
      setItems((current) => mergePages(current, page.items));
      setCursor(page.nextCursor);
    } catch (err) {
      setError(errorCodeOf(err));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  if (!account) {
    return (
      <View style={styles.screen}>
        {error ? <ErrorText code={error} /> : <ActivityIndicator />}
      </View>
    );
  }

  const sections = groupByDay(items).map((group) => ({
    title: capitalize(formatDay(group.date, locale)),
    data: group.items,
  }));

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.row}>
            <AccountIcon icon={account.icon} size={36} />
            <Text variant="headlineSmall" style={styles.flex}>
              {account.name}
            </Text>
            {account.isClosed && <Chip compact>{t("accounts.closedBadge")}</Chip>}
          </View>
          <AccountTabs accountId={account.id} active="expenses" />
          {/* Also on closed accounts: exporting is read only (FR-001). */}
          <ExportButton run={(format) => exportsApi.account(account.id, format)} />
          <Text variant="labelMedium">{t("expenses.total")}</Text>
          <Text variant="headlineMedium">
            {formatMoney(total, account.currency, account.currencyDecimals, locale)}
          </Text>
          <Text variant="bodySmall">{t("expenses.count", { count })}</Text>
          <View style={styles.row}>
            <Button
              mode="outlined"
              onPress={() =>
                router.push({
                  pathname: "/accounts/[accountId]/settings",
                  params: { accountId: account.id },
                })
              }
            >
              {t("expenses.settings")}
            </Button>
            {!account.isClosed && (
              <Button
                mode="contained"
                onPress={() =>
                  router.push({
                    pathname: "/accounts/[accountId]/expenses/new",
                    params: { accountId: account.id },
                  })
                }
              >
                {t("expenses.new")}
              </Button>
            )}
          </View>
          <ErrorText code={error} />
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text variant="titleSmall" style={styles.day}>
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => (
        <ExpenseListItem
          account={account}
          item={item}
          locale={locale}
          onPress={() =>
            router.push({
              pathname: "/accounts/[accountId]/expenses/[expenseId]",
              params: { accountId: account.id, expenseId: item.id },
            })
          }
        />
      )}
      ListEmptyComponent={
        <Text>
          {t("expenses.empty")} {account.isClosed ? "" : t("expenses.emptyCta")}
        </Text>
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator /> : null}
    />
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 8 },
  header: { gap: 8, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  flex: { flex: 1 },
  day: { marginTop: 12 },
});
