import { Link } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";

import { ErrorText, formStyles } from "../components/FormBits";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../services/api/auth";
import { ApiError, type ApiErrorCode, errorCodeOf } from "../services/api/types";
import { validateEmail } from "../utils/validation";

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signInWithTokens, sessionExpired } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [message, setMessage] = useState<string | null>(
    sessionExpired ? "auth.sessionExpired" : null,
  );
  const [lockedMinutes, setLockedMinutes] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    setMessage(null);
    setLockedMinutes(null);
    if (validateEmail(email)) {
      setMessage("validation.emailInvalid");
      return;
    }
    setPending(true);
    try {
      await signInWithTokens(await authApi.loginWithPassword(email.trim(), password));
    } catch (err) {
      if (err instanceof ApiError && err.code === "password_login_locked") {
        setLockedMinutes(Math.max(1, Math.ceil((err.retryAfterSeconds ?? 900) / 60)));
      } else {
        setError(errorCodeOf(err));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={formStyles.screen} keyboardShouldPersistTaps="handled">
      <Text variant="headlineMedium" style={formStyles.title}>
        {t("auth.login.title")}
      </Text>
      <Text style={{ textAlign: "center" }}>{t("common.slogan")}</Text>
      <GoogleSignInButton onMessage={setMessage} />
      <Text style={{ textAlign: "center" }}>{t("mobile.orUseEmail")}</Text>
      <TextInput
        mode="outlined"
        label={t("common.email")}
        accessibilityLabel={t("common.email")}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        mode="outlined"
        label={t("common.password")}
        accessibilityLabel={t("common.password")}
        secureTextEntry
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
      />
      <ErrorText messageKey={message} />
      {lockedMinutes !== null && (
        <Text accessibilityRole="alert">
          {t("auth.login.lockedMinutes", { count: lockedMinutes })}
        </Text>
      )}
      <ErrorText code={error} />
      <Button mode="contained" loading={pending} disabled={pending} onPress={submit}>
        {t("auth.login.submit")}
      </Button>
      <Link href="/login-code">{t("auth.login.useCode")}</Link>
      <Link href="/forgot-password">{t("auth.login.forgot")}</Link>
      <Link href="/register">
        {t("auth.login.noAccount")} {t("auth.login.register")}
      </Link>
    </ScrollView>
  );
}
