import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  HelperText,
  RadioButton,
  Text,
  TextInput,
} from "react-native-paper";

import { ErrorText, formStyles } from "../../components/FormBits";
import { accountsApi } from "../../services/api/accounts";
import { type SettlementInput, settlementsApi } from "../../services/api/settlements";
import { type AccountResponse, type ApiErrorCode, errorCodeOf } from "../../services/api/types";
import { formatDay, today } from "../../utils/expenseGroups";
import { type AmountError, parseAmountInput } from "../../utils/money";
import { newRequestId } from "../../utils/requestId";

type FieldError = AmountError | "fromRequired" | "toRequired" | "sameParticipant";

const SETTLEMENT_ERRORS = new Set<FieldError>(["fromRequired", "toRequired", "sameParticipant"]);

/** Manual settlement between two active participants (FR-013); it always starts empty. */
export default function SettlementFormScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const router = useRouter();
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [showPicker, setShowPicker] = useState(false);
  // Stable across retries of the same form, so a lost response never records two (FR-018).
  const [clientRequestId] = useState(newRequestId);
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [apiError, setApiError] = useState<ApiErrorCode | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    accountsApi
      .get(accountId)
      .then(setAccount)
      .catch((err) => setApiError(errorCodeOf(err)));
  }, [accountId]);

  if (!account) {
    return (
      <ScrollView contentContainerStyle={formStyles.screen}>
        {apiError ? <ErrorText code={apiError} /> : <ActivityIndicator />}
      </ScrollView>
    );
  }

  const decimals = account.currencyDecimals;

  function validate(): { input: SettlementInput } | { error: FieldError } {
    if (!fromId) return { error: "fromRequired" };
    if (!toId) return { error: "toRequired" };
    if (fromId === toId) return { error: "sameParticipant" };
    const parsed = parseAmountInput(amount, locale, decimals);
    if (!parsed.ok) return { error: parsed.error };
    return {
      input: {
        fromParticipantId: fromId,
        toParticipantId: toId,
        amount: parsed.value,
        date,
        source: "manual",
      },
    };
  }

  async function save() {
    if (!account || saving) return;
    setApiError(null);
    const checked = validate();
    if ("error" in checked) {
      setFieldError(checked.error);
      return;
    }
    setFieldError(null);
    setSaving(true);
    try {
      await settlementsApi.create(account.id, checked.input, clientRequestId);
      router.back();
    } catch (err) {
      setApiError(errorCodeOf(err));
    } finally {
      setSaving(false);
    }
  }

  const fieldMessage =
    fieldError === null
      ? null
      : SETTLEMENT_ERRORS.has(fieldError)
        ? t(`settlements.validation.${fieldError}`)
        : t(`expenses.validation.${fieldError}`, { decimals });

  return (
    <ScrollView contentContainerStyle={formStyles.screen} keyboardShouldPersistTaps="handled">
      <Text variant="headlineSmall">{t("settlements.newTitle")}</Text>
      <Text variant="labelLarge">{t("settlements.from")}</Text>
      <RadioButton.Group value={fromId} onValueChange={setFromId}>
        {account.participants.map((p) => (
          <RadioButton.Item
            key={p.id}
            label={p.name}
            value={p.id}
            accessibilityLabel={`${t("settlements.from")}: ${p.name}`}
          />
        ))}
      </RadioButton.Group>
      <Text variant="labelLarge">{t("settlements.to")}</Text>
      <RadioButton.Group value={toId} onValueChange={setToId}>
        {account.participants.map((p) => (
          <RadioButton.Item
            key={p.id}
            label={p.name}
            value={p.id}
            accessibilityLabel={`${t("settlements.to")}: ${p.name}`}
          />
        ))}
      </RadioButton.Group>
      <TextInput
        mode="outlined"
        label={t("settlements.amount", { currency: account.currency })}
        accessibilityLabel={t("settlements.amount", { currency: account.currency })}
        keyboardType={decimals === 0 ? "number-pad" : "decimal-pad"}
        value={amount}
        onChangeText={setAmount}
      />
      <Text variant="bodySmall">{t("settlements.currencyHint")}</Text>
      <View>
        <Text variant="labelLarge">{t("settlements.date")}</Text>
        <Button
          mode="outlined"
          accessibilityLabel={t("settlements.date")}
          onPress={() => setShowPicker(true)}
        >
          {formatDay(date, locale, { dateStyle: "medium" })}
        </Button>
        {showPicker && (
          <DateTimePicker
            mode="date"
            value={new Date(`${date}T12:00:00`)}
            onChange={(_event, selected) => {
              setShowPicker(false);
              if (selected) setDate(today(selected));
            }}
          />
        )}
      </View>
      {fieldMessage && (
        <HelperText type="error" visible accessibilityRole="alert">
          {fieldMessage}
        </HelperText>
      )}
      <ErrorText code={apiError} />
      <Button mode="contained" loading={saving} disabled={saving} onPress={save}>
        {saving ? t("settlements.saving") : t("settlements.save")}
      </Button>
    </ScrollView>
  );
}
