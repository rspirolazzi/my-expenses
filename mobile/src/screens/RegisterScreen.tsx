import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import { Button, HelperText, Text, TextInput } from "react-native-paper";

import { ErrorText, formStyles } from "../components/FormBits";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { authApi } from "../services/api/auth";
import { type ApiErrorCode, errorCodeOf } from "../services/api/types";
import { validateEmail, validateName, validatePassword } from "../utils/validation";

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    const problem =
      validateEmail(email) ??
      validatePassword(password, email) ??
      validateName(firstName) ??
      validateName(lastName);
    setMessage(problem ? `validation.${problem}` : null);
    if (problem) return;

    setPending(true);
    try {
      await authApi.register({
        email: email.trim(),
        password,
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        language: i18n.language,
      });
      router.push({ pathname: "/verify-email", params: { email: email.trim() } });
    } catch (err) {
      setError(errorCodeOf(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={formStyles.screen} keyboardShouldPersistTaps="handled">
      <Text variant="headlineMedium" style={formStyles.title}>
        {t("auth.register.title")}
      </Text>
      <GoogleSignInButton onMessage={setMessage} />
      <Text style={{ textAlign: "center" }}>{t("mobile.orUseEmail")}</Text>
      <TextInput
        mode="outlined"
        label={t("common.email")}
        accessibilityLabel={t("common.email")}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        mode="outlined"
        label={t("common.password")}
        accessibilityLabel={t("common.password")}
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />
      <HelperText type="info">{t("auth.register.passwordHint")}</HelperText>
      <TextInput
        mode="outlined"
        label={t("auth.register.firstName")}
        accessibilityLabel={t("auth.register.firstName")}
        maxLength={60}
        value={firstName}
        onChangeText={setFirstName}
      />
      <TextInput
        mode="outlined"
        label={t("auth.register.lastName")}
        accessibilityLabel={t("auth.register.lastName")}
        maxLength={60}
        value={lastName}
        onChangeText={setLastName}
      />
      <ErrorText messageKey={message} />
      <ErrorText code={error} />
      <Button mode="contained" loading={pending} disabled={pending} onPress={submit}>
        {t("auth.register.submit")}
      </Button>
      <Link href="/login">
        {t("auth.register.haveAccount")} {t("auth.register.login")}
      </Link>
    </ScrollView>
  );
}
