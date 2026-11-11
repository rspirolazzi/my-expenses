import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Chip,
  Divider,
  HelperText,
  List,
  Text,
} from "react-native-paper";

import { ConfirmDialog } from "../../components/accounts/AccountBits";
import { CategoryIcon, ExpenseHistory } from "../../components/expenses/ExpenseBits";
import { ErrorText, formStyles } from "../../components/FormBits";
import { accountsApi } from "../../services/api/accounts";
import { expensesApi } from "../../services/api/expenses";
import {
  type AccountResponse,
  type ApiErrorCode,
  errorCodeOf,
  type ExpenseResponse,
  type HistoryEntry,
} from "../../services/api/types";
import { formatDay } from "../../utils/expenseGroups";
import { formatMoney } from "../../utils/money";

export default function ExpenseDetailScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const router = useRouter();
  const { accountId, expenseId } = useLocalSearchParams<{ accountId: string; expenseId: string }>();
  const [data, setData] = useState<{
    account: AccountResponse;
    expense: ExpenseResponse;
    history: HistoryEntry[];
  } | null>(null);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [notice, setNotice] = useState<"conflict" | "gone" | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    try {
      const [account, expense, history] = await Promise.all([
        accountsApi.get(accountId),
        expensesApi.get(accountId, expenseId),
        expensesApi.history(accountId, expenseId),
      ]);
      setData({ account, expense, history });
    } catch (err) {
      const code = errorCodeOf(err);
      if (code === "not_found") setNotice("gone");
      else setError(code);
    }
  }, [accountId, expenseId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (notice === "gone") {
    return (
      <ScrollView contentContainerStyle={formStyles.screen}>
        <HelperText type="error" visible accessibilityRole="alert">
          {t("expenses.gone")}
        </HelperText>
        <Button onPress={() => router.back()}>{t("expenses.back")}</Button>
      </ScrollView>
    );
  }
  if (!data) {
    return (
      <View style={formStyles.screen}>
        {error ? <ErrorText code={error} /> : <ActivityIndicator />}
      </View>
    );
  }

  const { account, expense, history } = data;
  const money = (amount: string) =>
    formatMoney(amount, expense.currency, account.currencyDecimals, locale);

  async function remove() {
    setConfirming(false);
    try {
      await expensesApi.remove(account.id, expense.id, expense.version);
      router.back();
    } catch (err) {
      const code = errorCodeOf(err);
      if (code === "expense_conflict") {
        setNotice("conflict");
        await load();
      } else if (code === "not_found") setNotice("gone");
      else setError(code);
    }
  }

  return (
    <ScrollView contentContainerStyle={formStyles.screen}>
      <View style={styles.row}>
        <CategoryIcon icon={expense.categoryIcon} size={36} />
        <View style={styles.flex}>
          <Text variant="headlineSmall">{expense.title}</Text>
          <Text>{formatDay(expense.date, locale)}</Text>
        </View>
        <Text variant="titleLarge">{money(expense.amount)}</Text>
      </View>
      {expense.isPending && <Chip icon="alert-circle-outline">{t("expenses.pending")}</Chip>}
      {expense.isPending && <Text>{t("expenses.detail.pendingHint")}</Text>}
      {notice === "conflict" && (
        <HelperText type="error" visible accessibilityRole="alert">
          {t("expenses.conflict")}
        </HelperText>
      )}
      <List.Item
        title={t("expenses.detail.paidBy")}
        description={expense.paidBy?.name ?? t("expenses.noPayer")}
      />
      <List.Item
        title={t("expenses.detail.category")}
        description={t(`expenses.categories.${expense.categoryIcon}`)}
      />
      {expense.description ? (
        <List.Item title={t("expenses.detail.description")} description={expense.description} />
      ) : null}
      <Text variant="titleMedium">{t("expenses.detail.shares")}</Text>
      {expense.shares.map((share) => (
        <List.Item
          key={share.participant.id}
          title={share.participant.name}
          right={() => <Text>{money(share.amount)}</Text>}
        />
      ))}
      <ErrorText code={error} />
      {!account.isClosed && (
        <View style={styles.row}>
          <Button
            mode="contained"
            onPress={() =>
              router.push({
                pathname: "/accounts/[accountId]/expenses/[expenseId]/edit",
                params: { accountId: account.id, expenseId: expense.id },
              })
            }
          >
            {t("expenses.detail.edit")}
          </Button>
          <Button mode="outlined" textColor="#c62828" onPress={() => setConfirming(true)}>
            {t("expenses.detail.delete")}
          </Button>
        </View>
      )}
      <Divider />
      <ExpenseHistory account={account} entries={history} locale={locale} />
      <ConfirmDialog
        visible={confirming}
        title={t("expenses.dialogs.deleteTitle")}
        message={t("expenses.dialogs.deleteBody")}
        onCancel={() => setConfirming(false)}
        onConfirm={remove}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  flex: { flex: 1 },
});
