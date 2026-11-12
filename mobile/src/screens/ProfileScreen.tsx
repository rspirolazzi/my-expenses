import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import { Button, Divider, SegmentedButtons, Text, TextInput } from "react-native-paper";

import { CurrencyPicker } from "../components/CurrencyPicker";
import { ExportButton } from "../components/exports/ExportButton";
import { CodeInput, ErrorText, formStyles } from "../components/FormBits";
import { useAuth } from "../hooks/useAuth";
import { usePreferences } from "../hooks/usePreferences";
import { exportsApi } from "../services/api/exports";
import { type ApiErrorCode, errorCodeOf } from "../services/api/types";
import { usersApi } from "../services/api/users";
import { displayName } from "../utils/displayName";
import { validateEmail, validateName } from "../utils/validation";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, setUser, logout } = useAuth();
  const prefs = usePreferences();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [newEmail, setNewEmail] = useState("");
  const [emailStep, setEmailStep] = useState<"email" | "code" | "done">("email");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  async function saveNames() {
    setSaved(false);
    setError(null);
    const problem = validateName(firstName) ?? validateName(lastName);
    setMessage(problem ? `validation.${problem}` : null);
    if (problem) return;
    try {
      // An emptied field is sent as null, which clears it.
      setUser(
        await usersApi.updateMe({
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
        }),
      );
      setSaved(true);
    } catch (err) {
      setError(errorCodeOf(err));
    }
  }

  async function requestEmailChange() {
    setError(null);
    const problem = validateEmail(newEmail);
    setMessage(problem ? `validation.${problem}` : null);
    if (problem) return;
    try {
      await usersApi.requestEmailChange(newEmail.trim());
      setEmailStep("code");
    } catch (err) {
      setError(errorCodeOf(err));
    }
  }

  async function confirmEmailChange(code: string) {
    setError(null);
    try {
      setUser(await usersApi.confirmEmailChange(code));
      setEmailStep("done");
    } catch (err) {
      setError(errorCodeOf(err));
    }
  }

  return (
    <ScrollView contentContainerStyle={formStyles.screen} keyboardShouldPersistTaps="handled">
      <Text variant="headlineMedium">{t("profile.title")}</Text>
      <Text variant="titleMedium">{displayName(user)}</Text>

      <Text variant="titleSmall">{t("profile.personal")}</Text>
      <TextInput
        mode="outlined"
        label={t("profile.firstName")}
        accessibilityLabel={t("profile.firstName")}
        maxLength={60}
        value={firstName}
        onChangeText={setFirstName}
      />
      <TextInput
        mode="outlined"
        label={t("profile.lastName")}
        accessibilityLabel={t("profile.lastName")}
        maxLength={60}
        value={lastName}
        onChangeText={setLastName}
      />
      <Button mode="contained" onPress={saveNames}>
        {t("common.save")}
      </Button>
      {saved && <Text>{t("profile.saved")}</Text>}

      <Divider />
      <Text variant="titleSmall">{t("profile.preferences")}</Text>
      <Text>{t("profile.language")}</Text>
      <SegmentedButtons
        value={user.preferences.language}
        onValueChange={(value) => prefs.setLanguage(value as "es" | "en")}
        buttons={[
          { value: "es", label: t("profile.languages.es") },
          { value: "en", label: t("profile.languages.en") },
        ]}
      />
      <Text>{t("profile.theme")}</Text>
      <SegmentedButtons
        value={user.preferences.theme}
        onValueChange={(value) => prefs.setTheme(value as "light" | "dark" | "system")}
        buttons={[
          { value: "light", label: t("profile.themes.light") },
          { value: "dark", label: t("profile.themes.dark") },
          { value: "system", label: t("profile.themes.system") },
        ]}
      />
      <Text>{t("profile.currency")}</Text>
      <CurrencyPicker
        label={t("profile.currency")}
        value={user.preferences.defaultCurrency ?? null}
        onChange={prefs.setCurrency}
      />
      <ErrorText code={prefs.error} />

      <Divider />
      <Text variant="titleSmall">{t("profile.email")}</Text>
      <Text>
        {t("profile.currentEmail")}: {user.email}
      </Text>
      {emailStep === "email" && (
        <>
          <TextInput
            mode="outlined"
            label={t("profile.newEmail")}
            accessibilityLabel={t("profile.newEmail")}
            autoCapitalize="none"
            keyboardType="email-address"
            value={newEmail}
            onChangeText={setNewEmail}
          />
          <Button mode="outlined" onPress={requestEmailChange}>
            {t("profile.sendCode")}
          </Button>
        </>
      )}
      {emailStep === "code" && (
        <>
          <Text>{t("profile.codeSentTo", { email: newEmail.trim() })}</Text>
          <CodeInput label={t("profile.codeLabel")} onComplete={confirmEmailChange} />
        </>
      )}
      {emailStep === "done" && <Text>{t("profile.emailChanged", { email: user.email })}</Text>}
      <ErrorText messageKey={message} />
      <ErrorText code={error} />

      <Divider />
      <Text variant="titleSmall">{t("exports.mineTitle")}</Text>
      <Text variant="bodySmall">{t("exports.mineHint")}</Text>
      <ExportButton run={exportsApi.mine} label={t("exports.mineButton")} />

      <Divider />
      <Button mode="text" onPress={logout}>
        {t("auth.logout")}
      </Button>
    </ScrollView>
  );
}
