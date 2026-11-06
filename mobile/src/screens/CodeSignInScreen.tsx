import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";

import { CodeInput, ErrorText, formStyles, ResendButton } from "../components/FormBits";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../services/api/auth";
import { ApiError, type ApiErrorCode, errorCodeOf } from "../services/api/types";
import { validateEmail, validatePassword } from "../utils/validation";

/** US3 (`login-code`) and US4 (`password-reset`): ask for the email, then use the emailed code. */
export default function CodeSignInScreen({ kind }: { kind: "login-code" | "password-reset" }) {
  const { t } = useTranslation();
  const ns = kind === "login-code" ? "auth.loginCode" : "auth.forgotPassword";
  const { signInWithTokens } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  const request = (value: string) =>
    kind === "login-code" ? authApi.requestLoginCode(value) : authApi.requestPasswordReset(value);

  async function sendCode() {
    setError(null);
    const problem = validateEmail(email);
    setMessage(problem ? `validation.${problem}` : null);
    if (problem) return;
    setPending(true);
    try {
      await request(email.trim());
      setStep("code");
    } catch (err) {
      setError(errorCodeOf(err));
    } finally {
      setPending(false);
    }
  }

  async function signIn(codeValue: string) {
    setError(null);
    if (kind === "password-reset") {
      const problem = validatePassword(password, email);
      setMessage(problem ? `validation.${problem}` : null);
      if (problem) return;
    }
    setPending(true);
    try {
      const auth =
        kind === "login-code"
          ? await authApi.verifyLoginCode(email.trim(), codeValue)
          : await authApi.confirmPasswordReset(email.trim(), codeValue, password);
      await signInWithTokens(auth);
    } catch (err) {
      setError(errorCodeOf(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={formStyles.screen} keyboardShouldPersistTaps="handled">
      <Text variant="headlineMedium" style={formStyles.title}>
        {t(`${ns}.title`)}
      </Text>
      {step === "email" ? (
        <>
          <Text>{t(`${ns}.intro`)}</Text>
          <TextInput
            mode="outlined"
            label={t("common.email")}
            accessibilityLabel={t("common.email")}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <ErrorText messageKey={message} />
          <ErrorText code={error} />
          <Button mode="contained" loading={pending} disabled={pending} onPress={sendCode}>
            {t(`${ns}.request`)}
          </Button>
        </>
      ) : (
        <>
          <Text>{t(`${ns}.sentTo`, { email: email.trim() })}</Text>
          <CodeInput
            label={t(`${ns}.codeLabel`)}
            disabled={pending}
            onComplete={(value) => {
              setCode(value);
              if (kind === "login-code") void signIn(value);
            }}
          />
          {kind === "password-reset" && (
            <TextInput
              mode="outlined"
              label={t("auth.forgotPassword.newPassword")}
              accessibilityLabel={t("auth.forgotPassword.newPassword")}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          )}
          <ErrorText messageKey={message} />
          <ErrorText code={error} />
          <Button
            mode="contained"
            loading={pending}
            disabled={pending || code.length !== 6}
            onPress={() => signIn(code)}
          >
            {t(`${ns}.submit`)}
          </Button>
          <ResendButton
            onResend={async () => {
              try {
                await request(email.trim());
                return { ok: true };
              } catch (err) {
                setError(errorCodeOf(err));
                return {
                  ok: false,
                  retryAfterSeconds: err instanceof ApiError ? err.retryAfterSeconds : undefined,
                };
              }
            }}
          />
        </>
      )}
    </ScrollView>
  );
}
