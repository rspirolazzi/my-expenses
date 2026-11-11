import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Card, Text } from "react-native-paper";

import type { AccountBalances, BalanceEntry } from "../../services/api/types";
import { absAmount, amountSign } from "../../utils/balanceTotals";
import { formatMoney } from "../../utils/money";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** "Te deben 60,00", "Debés 30,00", "Estás al día" for me; "Le deben"/"Debe"/"Al día" otherwise. */
export function balanceText(
  t: Translate,
  entry: Pick<BalanceEntry, "amount" | "isMe">,
  currency: string,
  decimals: number,
  locale: string,
): string {
  const amount = formatMoney(absAmount(entry.amount), currency, decimals, locale);
  const sign = amountSign(entry.amount);
  if (entry.isMe) {
    if (sign > 0) return t("balances.owedToYou", { amount });
    if (sign < 0) return t("balances.youOwe", { amount });
    return t("balances.youSettled");
  }
  if (sign > 0) return t("balances.owed", { amount });
  if (sign < 0) return t("balances.owes", { amount });
  return t("balances.settled");
}

/**
 * The balance of each active participant, mine highlighted in plain words (FR-007), plus the
 * pending expenses notice that leads to the "Gastos" tab (FR-006).
 */
export function BalanceList({
  balances,
  locale,
  onOpenExpenses,
}: {
  balances: AccountBalances;
  locale: string;
  onOpenExpenses: () => void;
}) {
  const { t } = useTranslation();
  const noDebts = balances.balances.every((entry) => amountSign(entry.amount) === 0);
  return (
    <View style={styles.list}>
      <Text variant="titleMedium">{t("balances.title")}</Text>
      {balances.pendingExpenses > 0 && (
        <View>
          <Text variant="bodyMedium" style={styles.bold}>
            {t("balances.pending", { count: balances.pendingExpenses })}
          </Text>
          <Text variant="bodySmall">{t("balances.pendingHint")}</Text>
          <Button compact mode="text" onPress={onOpenExpenses}>
            {t("balances.pendingLink")}
          </Button>
        </View>
      )}
      {balances.balances.map((entry) => (
        <Card
          key={entry.participant.id}
          mode={entry.isMe ? "contained" : "outlined"}
          testID={entry.isMe ? "balance-me" : `balance-${entry.participant.id}`}
        >
          <Card.Content style={styles.row}>
            <Text variant="bodyLarge" style={entry.isMe ? styles.bold : undefined}>
              {entry.isMe
                ? `${entry.participant.name} (${t("balances.you")})`
                : entry.participant.name}
            </Text>
            <Text variant="bodyLarge" style={styles.bold}>
              {balanceText(t, entry, balances.currency, balances.currencyDecimals, locale)}
            </Text>
          </Card.Content>
        </Card>
      ))}
      {noDebts && <Text>{t("balances.noDebts")}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  bold: { fontWeight: "bold" },
});
