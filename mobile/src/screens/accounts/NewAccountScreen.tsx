import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { Button, HelperText, IconButton, Text, TextInput } from "react-native-paper";

import { IconPicker } from "../../components/accounts/AccountBits";
import { CurrencyPicker } from "../../components/CurrencyPicker";
import { ErrorText, formStyles } from "../../components/FormBits";
import { useAuth } from "../../hooks/useAuth";
import { accountsApi } from "../../services/api/accounts";
import { type AccountIcon, type ApiErrorCode, errorCodeOf } from "../../services/api/types";
import {
  ACCOUNT_NAME_MAX,
  DEFAULT_ACCOUNT_ICON,
  hasDuplicateNames,
  isValidAccountName,
  isValidParticipantName,
  PARTICIPANT_NAME_MAX,
} from "../../utils/accountIcons";
import { displayName } from "../../utils/displayName";

export default function NewAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<AccountIcon>(DEFAULT_ACCOUNT_ICON);
  // FR-003 / FR-004: prefilled currency and the creator's visible name.
  const [currency, setCurrency] = useState<string | null>(
    user?.preferences.defaultCurrency ?? null,
  );
  const [me, setMe] = useState(user ? displayName(user).slice(0, PARTICIPANT_NAME_MAX) : "");
  const [others, setOthers] = useState<string[]>([""]);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  async function create() {
    setError(null);
    const otherNames = others.map((o) => o.trim()).filter(Boolean);
    const names = [me, ...otherNames];
    if (!isValidAccountName(name)) return setProblem("accounts.form.nameRequired");
    if (!names.every(isValidParticipantName)) return setProblem("accounts.form.participantInvalid");
    if (hasDuplicateNames(names)) return setProblem("accounts.form.duplicateNames");
    if (!currency) return;
    setProblem(null);
    setPending(true);
    try {
      const account = await accountsApi.create({
        name: name.trim(),
        description: description.trim() || null,
        icon,
        currency,
        myParticipantName: me.trim(),
        otherParticipants: otherNames,
      });
      router.replace({ pathname: "/accounts/[accountId]", params: { accountId: account.id } });
    } catch (err) {
      setError(errorCodeOf(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={formStyles.screen} keyboardShouldPersistTaps="handled">
      <Text variant="headlineMedium">{t("accounts.new")}</Text>
      <TextInput
        mode="outlined"
        label={t("accounts.form.name")}
        accessibilityLabel={t("accounts.form.name")}
        maxLength={ACCOUNT_NAME_MAX}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        mode="outlined"
        label={t("accounts.form.description")}
        accessibilityLabel={t("accounts.form.description")}
        multiline
        maxLength={500}
        value={description}
        onChangeText={setDescription}
      />
      <IconPicker value={icon} onChange={setIcon} />
      <CurrencyPicker label={t("accounts.form.currency")} value={currency} onChange={setCurrency} />
      <HelperText type="info">{t("accounts.form.currencyHint")}</HelperText>
      <TextInput
        mode="outlined"
        label={t("accounts.form.me")}
        accessibilityLabel={t("accounts.form.me")}
        maxLength={PARTICIPANT_NAME_MAX}
        value={me}
        onChangeText={setMe}
      />
      <Text variant="labelLarge">{t("accounts.form.others")}</Text>
      {others.map((value, index) => (
        <View key={index} style={{ flexDirection: "row", alignItems: "center" }}>
          <TextInput
            style={{ flex: 1 }}
            mode="outlined"
            label={`${t("accounts.form.participantPlaceholder")} ${index + 1}`}
            accessibilityLabel={`${t("accounts.form.participantPlaceholder")} ${index + 1}`}
            maxLength={PARTICIPANT_NAME_MAX}
            value={value}
            onChangeText={(text) => setOthers(others.map((o, i) => (i === index ? text : o)))}
          />
          <IconButton
            icon="close"
            accessibilityLabel={`${t("accounts.form.removeRow")} ${index + 1}`}
            onPress={() => setOthers(others.filter((_, i) => i !== index))}
          />
        </View>
      ))}
      <Button mode="text" onPress={() => setOthers([...others, ""])}>
        {t("accounts.form.addParticipant")}
      </Button>
      <ErrorText messageKey={problem} />
      <ErrorText code={error} />
      <Button mode="contained" loading={pending} disabled={pending || !currency} onPress={create}>
        {t("accounts.form.create")}
      </Button>
    </ScrollView>
  );
}
