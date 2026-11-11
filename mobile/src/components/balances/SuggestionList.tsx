import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Card, Text } from "react-native-paper";

import { settlementsApi } from "../../services/api/settlements";
import {
  type AccountResponse,
  type ApiErrorCode,
  errorCodeOf,
  type SuggestedTransfer,
} from "../../services/api/types";
import { formatDay, today } from "../../utils/expenseGroups";
import { formatMoney } from "../../utils/money";
import { newRequestId } from "../../utils/requestId";
import { ConfirmDialog } from "../accounts/AccountBits";
import { ErrorText } from "../FormBits";

interface Open {
  suggestion: SuggestedTransfer;
  date: string;
  /** Stable across retries of the same dialog, so a lost response never records two. */
  clientRequestId: string;
}

/** Suggested settlements, each with "Marcar como pagado" in a fixed dialog (FR-012). */
export function SuggestionList({
  account,
  suggestions,
  locale,
  onSaved,
}: {
  account: AccountResponse;
  suggestions: SuggestedTransfer[];
  locale: string;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Open | null>(null);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [saving, setSaving] = useState(false);
  const money = (amount: string) =>
    formatMoney(amount, account.currency, account.currencyDecimals, locale);

  function close() {
    setOpen(null);
    setError(null);
  }

  async function confirm() {
    if (!open || saving) return;
    setSaving(true);
    setError(null);
    try {
      await settlementsApi.create(
        account.id,
        {
          fromParticipantId: open.suggestion.from.id,
          toParticipantId: open.suggestion.to.id,
          amount: open.suggestion.amount,
          date: open.date,
          source: "suggestion",
        },
        open.clientRequestId,
      );
      close();
      onSaved();
    } catch (err) {
      setError(errorCodeOf(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.list}>
      <Text variant="titleMedium">{t("balances.suggestions")}</Text>
      {suggestions.length === 0 ? (
        <Text>{t("balances.nothingPending")}</Text>
      ) : (
        suggestions.map((suggestion) => (
          <Card key={`${suggestion.from.id}-${suggestion.to.id}`} mode="outlined">
            <Card.Content style={styles.row}>
              <Text variant="bodyLarge">
                {t("balances.transfer", { from: suggestion.from.name, to: suggestion.to.name })}
              </Text>
              <Text variant="bodyLarge">{money(suggestion.amount)}</Text>
            </Card.Content>
            {!account.isClosed && (
              <Card.Actions>
                <Button
                  onPress={() =>
                    setOpen({ suggestion, date: today(), clientRequestId: newRequestId() })
                  }
                >
                  {t("balances.markPaid")}
                </Button>
              </Card.Actions>
            )}
          </Card>
        ))
      )}
      <ConfirmDialog
        visible={open !== null}
        title={t("balances.dialogTitle")}
        message={
          open
            ? t("balances.dialogBody", {
                from: open.suggestion.from.name,
                to: open.suggestion.to.name,
                amount: money(open.suggestion.amount),
                date: formatDay(open.date, locale, { dateStyle: "long" }),
              })
            : ""
        }
        confirmLabel={t("balances.confirm")}
        cancelLabel={t("balances.cancel")}
        onConfirm={confirm}
        onCancel={close}
      >
        <Text variant="bodySmall">{t("balances.dialogHint")}</Text>
        <ErrorText code={error} />
      </ConfirmDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
});
