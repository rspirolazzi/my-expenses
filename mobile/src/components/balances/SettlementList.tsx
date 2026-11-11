import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Chip, HelperText, Text } from "react-native-paper";

import { settlementsApi } from "../../services/api/settlements";
import {
  type AccountResponse,
  type ApiErrorCode,
  errorCodeOf,
  type SettlementResponse,
} from "../../services/api/types";
import { formatDay } from "../../utils/expenseGroups";
import { formatMoney } from "../../utils/money";
import { ConfirmDialog } from "../accounts/AccountBits";
import { ErrorText } from "../FormBits";

/**
 * Active settlements, most recent first (FR-015); those of a removed participant stay marked.
 * Any member deletes one after confirming with "Continuar" (FR-016), unless the account is
 * closed. After a delete, `onChanged` reloads the balances.
 */
export function SettlementList({
  account,
  items,
  locale,
  hasMore,
  loadingMore,
  onLoadMore,
  onChanged,
}: {
  account: AccountResponse;
  items: SettlementResponse[];
  locale: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [toDelete, setToDelete] = useState<SettlementResponse | null>(null);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [gone, setGone] = useState(false);

  async function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    setError(null);
    setGone(false);
    try {
      await settlementsApi.remove(account.id, target.id);
      onChanged();
    } catch (err) {
      const code = errorCodeOf(err);
      if (code === "not_found") {
        setGone(true);
        onChanged();
      } else {
        setError(code);
      }
    }
  }

  return (
    <View style={styles.list}>
      <Text variant="titleMedium">{t("settlements.title")}</Text>
      {gone && (
        <HelperText type="error" visible accessibilityRole="alert">
          {t("settlements.gone")}
        </HelperText>
      )}
      <ErrorText code={error} />
      {items.length === 0 ? (
        <Text>{t("settlements.empty")}</Text>
      ) : (
        items.map((item) => (
          <Card
            key={item.id}
            mode="outlined"
            style={item.isExcluded ? styles.excluded : undefined}
            testID={`settlement-${item.id}`}
          >
            <Card.Content style={styles.row}>
              <View style={styles.flex}>
                <Text variant="bodyLarge">
                  {t("settlements.row", { from: item.from.name, to: item.to.name })}
                </Text>
                <Text variant="bodySmall">
                  {formatDay(item.date, locale, { dateStyle: "medium" })}
                </Text>
                {item.isExcluded && (
                  <Chip compact style={styles.chip}>
                    {t("settlements.removed")}
                  </Chip>
                )}
              </View>
              <Text variant="bodyLarge">
                {formatMoney(item.amount, account.currency, account.currencyDecimals, locale)}
              </Text>
            </Card.Content>
            {!account.isClosed && (
              <Card.Actions>
                <Button onPress={() => setToDelete(item)}>{t("settlements.delete")}</Button>
              </Card.Actions>
            )}
          </Card>
        ))
      )}
      {loadingMore && <ActivityIndicator />}
      {hasMore && !loadingMore && (
        <Button mode="outlined" onPress={onLoadMore}>
          {t("settlements.loadMore")}
        </Button>
      )}
      <ConfirmDialog
        visible={toDelete !== null}
        title={t("settlements.deleteTitle")}
        message={t("settlements.deleteBody")}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  flex: { flex: 1, gap: 4 },
  excluded: { opacity: 0.7 },
  chip: { alignSelf: "flex-start" },
});
