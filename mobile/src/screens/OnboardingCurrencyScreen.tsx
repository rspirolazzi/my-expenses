import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import { Button, HelperText, Text } from "react-native-paper";

import { CurrencyPicker } from "../components/CurrencyPicker";
import { ErrorText, formStyles } from "../components/FormBits";
import { useAuth } from "../hooks/useAuth";
import { type ApiErrorCode, errorCodeOf } from "../services/api/types";
import { usersApi } from "../services/api/users";
import { suggestedCurrency } from "../utils/currencies";

/** Shown until the user picks a default currency (FR-020a); the layout then opens the Dashboard. */
export default function OnboardingCurrencyScreen() {
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const [suggestion] = useState(suggestedCurrency);
  const [currency, setCurrency] = useState<string | null>(suggestion);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  async function confirm() {
    if (!currency) return;
    setPending(true);
    try {
      setUser(await usersApi.updateMe({ preferences: { defaultCurrency: currency } }));
    } catch (err) {
      setError(errorCodeOf(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={formStyles.screen}>
      <Text variant="headlineMedium" style={formStyles.title}>
        {t("onboarding.title")}
      </Text>
      <Text>{t("onboarding.intro")}</Text>
      <CurrencyPicker label={t("onboarding.currency")} value={currency} onChange={setCurrency} />
      {suggestion !== null && currency === suggestion && (
        <HelperText type="info">{t("onboarding.suggested")}</HelperText>
      )}
      <ErrorText code={error} />
      <Button mode="contained" loading={pending} disabled={!currency || pending} onPress={confirm}>
        {t("common.continue")}
      </Button>
    </ScrollView>
  );
}
