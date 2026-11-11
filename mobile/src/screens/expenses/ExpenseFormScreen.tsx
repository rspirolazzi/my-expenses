import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Checkbox,
  HelperText,
  RadioButton,
  Text,
  TextInput,
} from "react-native-paper";

import { CategoryPicker } from "../../components/expenses/ExpenseBits";
import { ErrorText, formStyles } from "../../components/FormBits";
import { accountsApi } from "../../services/api/accounts";
import { type ExpenseInput, expensesApi } from "../../services/api/expenses";
import {
  type AccountResponse,
  ApiError,
  type ApiErrorCode,
  type CategoryIcon,
  errorCodeOf,
  type ExpenseResponse,
} from "../../services/api/types";
import { DEFAULT_CATEGORY } from "../../utils/categoryIcons";
import { formatDay, today } from "../../utils/expenseGroups";
import { type AmountError, amountToInput, parseAmountInput } from "../../utils/money";

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 500;

type FieldError =
  AmountError | "titleRequired" | "payerRequired" | "participantsRequired" | "descriptionTooLong";

interface FormState {
  date: string;
  title: string;
  amount: string;
  paidById: string;
  participantIds: string[];
  categoryIcon: CategoryIcon;
  description: string;
}

function initialState(
  account: AccountResponse,
  expense: ExpenseResponse | null,
  locale: string,
): FormState {
  const active = new Set(account.participants.map((p) => p.id));
  return {
    date: expense?.date ?? today(),
    title: expense?.title ?? "",
    amount: expense ? amountToInput(expense.amount, locale) : "",
    paidById: expense ? (expense.paidBy?.id ?? "") : account.myParticipantId,
    participantIds: expense
      ? expense.participants.map((p) => p.id).filter((id) => active.has(id))
      : account.participants.map((p) => p.id),
    categoryIcon: expense?.categoryIcon ?? DEFAULT_CATEGORY,
    description: expense?.description ?? "",
  };
}

function newRequestId(): string {
  const random = () => Math.random().toString(16).slice(2, 10).padEnd(8, "0");
  const hex = `${random()}${random()}${random()}${random()}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Create (no expenseId) or edit an expense. */
export default function ExpenseFormScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const router = useRouter();
  const { accountId, expenseId } = useLocalSearchParams<{
    accountId: string;
    expenseId?: string;
  }>();
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [expense, setExpense] = useState<ExpenseResponse | null>(null);
  const [state, setState] = useState<FormState | null>(null);
  // Stable across retries of the same form, so a lost response never creates two (research R7).
  const [clientRequestId] = useState(newRequestId);
  const [showPicker, setShowPicker] = useState(false);
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [apiError, setApiError] = useState<ApiErrorCode | null>(null);
  const [notice, setNotice] = useState<"conflict" | "gone" | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      accountsApi.get(accountId),
      expenseId ? expensesApi.get(accountId, expenseId) : Promise.resolve(null),
    ])
      .then(([nextAccount, nextExpense]) => {
        setAccount(nextAccount);
        setExpense(nextExpense);
        setState(initialState(nextAccount, nextExpense, locale));
      })
      .catch((err) => setApiError(errorCodeOf(err)));
  }, [accountId, expenseId, locale]);

  if (!account || !state) {
    return (
      <ScrollView contentContainerStyle={formStyles.screen}>
        {apiError ? <ErrorText code={apiError} /> : <ActivityIndicator />}
      </ScrollView>
    );
  }

  const decimals = account.currencyDecimals;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((current) => (current ? { ...current, [key]: value } : current));

  function validate(current: FormState): { input: ExpenseInput } | { error: FieldError } {
    const title = current.title.trim();
    if (!title || title.length > TITLE_MAX) return { error: "titleRequired" };
    const amount = parseAmountInput(current.amount, locale, decimals);
    if (!amount.ok) return { error: amount.error };
    if (!current.paidById) return { error: "payerRequired" };
    if (current.participantIds.length === 0) return { error: "participantsRequired" };
    const description = current.description.trim();
    if (description.length > DESCRIPTION_MAX) return { error: "descriptionTooLong" };
    return {
      input: {
        date: current.date,
        title,
        description: description || null,
        amount: amount.value,
        paidById: current.paidById,
        participantIds: current.participantIds,
        categoryIcon: current.categoryIcon,
      },
    };
  }

  async function save() {
    if (!account || !state) return;
    setApiError(null);
    setNotice(null);
    const checked = validate(state);
    if ("error" in checked) {
      setFieldError(checked.error);
      return;
    }
    setFieldError(null);
    setSaving(true);
    try {
      const saved = expense
        ? await expensesApi.update(account.id, expense.id, checked.input, expense.version)
        : await expensesApi.create(account.id, checked.input, clientRequestId);
      router.replace({
        pathname: "/accounts/[accountId]/expenses/[expenseId]",
        params: { accountId: account.id, expenseId: saved.id },
      });
    } catch (err) {
      const code = errorCodeOf(err);
      const current =
        err instanceof ApiError ? (err.details?.current as ExpenseResponse | undefined) : undefined;
      if (code === "expense_conflict" && current) {
        setExpense(current);
        setState(initialState(account, current, locale));
        setNotice("conflict");
      } else if (expense && code === "not_found") {
        setNotice("gone");
      } else {
        setApiError(code);
      }
    } finally {
      setSaving(false);
    }
  }

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

  const toggle = (id: string) =>
    set(
      "participantIds",
      state.participantIds.includes(id)
        ? state.participantIds.filter((p) => p !== id)
        : [...state.participantIds, id],
    );

  return (
    <ScrollView contentContainerStyle={formStyles.screen} keyboardShouldPersistTaps="handled">
      <Text variant="headlineSmall">
        {expense ? t("expenses.form.editTitle") : t("expenses.form.newTitle")}
      </Text>
      {notice === "conflict" && (
        <HelperText type="error" visible accessibilityRole="alert">
          {t("expenses.conflict")}
        </HelperText>
      )}
      <View>
        <Text variant="labelLarge">{t("expenses.form.date")}</Text>
        <Button
          mode="outlined"
          accessibilityLabel={t("expenses.form.date")}
          onPress={() => setShowPicker(true)}
        >
          {formatDay(state.date, locale, { dateStyle: "medium" })}
        </Button>
        {showPicker && (
          <DateTimePicker
            mode="date"
            value={new Date(`${state.date}T12:00:00`)}
            onChange={(_event, selected) => {
              setShowPicker(false);
              if (selected) set("date", today(selected));
            }}
          />
        )}
      </View>
      <TextInput
        mode="outlined"
        label={t("expenses.form.title")}
        accessibilityLabel={t("expenses.form.title")}
        maxLength={TITLE_MAX}
        value={state.title}
        onChangeText={(text) => set("title", text)}
      />
      <TextInput
        mode="outlined"
        label={t("expenses.form.amount", { currency: account.currency })}
        accessibilityLabel={t("expenses.form.amount", { currency: account.currency })}
        keyboardType={decimals === 0 ? "number-pad" : "decimal-pad"}
        value={state.amount}
        onChangeText={(text) => set("amount", text)}
      />
      <Text variant="bodySmall">{t("expenses.form.currencyHint")}</Text>

      <Text variant="labelLarge">{t("expenses.form.paidBy")}</Text>
      <RadioButton.Group value={state.paidById} onValueChange={(value) => set("paidById", value)}>
        {account.participants.map((p) => (
          <RadioButton.Item key={p.id} label={p.name} value={p.id} />
        ))}
      </RadioButton.Group>

      <Text variant="labelLarge">{t("expenses.form.participants")}</Text>
      {account.participants.map((p) => (
        <Checkbox.Item
          key={p.id}
          label={p.name}
          status={state.participantIds.includes(p.id) ? "checked" : "unchecked"}
          onPress={() => toggle(p.id)}
        />
      ))}

      <CategoryPicker value={state.categoryIcon} onChange={(icon) => set("categoryIcon", icon)} />
      <TextInput
        mode="outlined"
        label={t("expenses.form.description")}
        accessibilityLabel={t("expenses.form.description")}
        multiline
        maxLength={DESCRIPTION_MAX}
        value={state.description}
        onChangeText={(text) => set("description", text)}
      />
      {fieldError && (
        <HelperText type="error" visible accessibilityRole="alert">
          {t(`expenses.validation.${fieldError}`, { decimals })}
        </HelperText>
      )}
      <ErrorText code={apiError} />
      <Button mode="contained" loading={saving} disabled={saving} onPress={save}>
        {saving ? t("expenses.form.saving") : t("expenses.form.save")}
      </Button>
    </ScrollView>
  );
}
