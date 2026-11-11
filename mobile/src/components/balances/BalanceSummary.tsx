import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { AccountSummary } from "../../services/api/types";
import { totalsByCurrency } from "../../utils/balanceTotals";
import { formatMoney } from "../../utils/money";

/**
 * "Te deben" and "Debés" per currency over every account, closed ones included (FR-024). Amounts
 * of different currencies are never added together.
 */
export function BalanceSummary({
  accounts,
  locale,
}: {
  accounts: AccountSummary[];
  locale: string;
}) {
  const { t } = useTranslation();
  const totals = totalsByCurrency(accounts);
  if (totals.length === 0) return <Text>{t("dashboard.balances.allSettled")}</Text>;
  const column = (label: string, pick: "owedToMe" | "iOwe", testID: string) => (
    <View style={styles.column} testID={testID}>
      <Text variant="labelMedium">{label}</Text>
      {totals
        .filter((total) => /[1-9]/.test(total[pick]))
        .map((total) => (
          <Text key={total.currency} variant="titleMedium">
            {formatMoney(total[pick], total.currency, total.decimals, locale)}
          </Text>
        ))}
    </View>
  );
  return (
    <View style={styles.summary}>
      <Text variant="titleMedium">{t("dashboard.balances.title")}</Text>
      <View style={styles.row}>
        {column(t("dashboard.balances.owedToYou"), "owedToMe", "owed-to-me")}
        {column(t("dashboard.balances.youOwe"), "iOwe", "i-owe")}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 8 },
  row: { flexDirection: "row", gap: 24, flexWrap: "wrap" },
  column: { gap: 4 },
});
