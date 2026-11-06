import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, HelperText, Text, TextInput } from "react-native-paper";

import type { ApiErrorCode } from "../services/api/types";

export function ErrorText({
  code,
  messageKey,
}: {
  code?: ApiErrorCode | null;
  messageKey?: string | null;
}) {
  const { t } = useTranslation();
  const key = messageKey ?? (code ? `errors.${code}` : null);
  if (!key) return null;
  return (
    <HelperText type="error" visible accessibilityRole="alert">
      {t(key)}
    </HelperText>
  );
}

interface CodeInputProps {
  label: string;
  onComplete: (code: string) => void;
  disabled?: boolean;
}

/** One field for a 6-digit code; accepts pasting and submits when complete. */
export function CodeInput({ label, onComplete, disabled }: CodeInputProps) {
  const [value, setValue] = useState("");
  return (
    <TextInput
      mode="outlined"
      label={label}
      accessibilityLabel={label}
      value={value}
      disabled={disabled}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={6}
      style={styles.code}
      onChangeText={(raw) => {
        const digits = raw.replace(/\D/g, "").slice(0, 6);
        setValue(digits);
        if (digits.length === 6) onComplete(digits);
      }}
    />
  );
}

interface ResendButtonProps {
  onResend: () => Promise<{ ok: boolean; retryAfterSeconds?: number }>;
  initialCooldown?: number;
}

/** Resend with countdown; honours `retryAfterSeconds` from `rate_limited`. */
export function ResendButton({ onResend, initialCooldown = 60 }: ResendButtonProps) {
  const { t } = useTranslation();
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  return (
    <View>
      <Button
        mode="text"
        disabled={cooldown > 0}
        onPress={async () => {
          const result = await onResend();
          if (result.ok) {
            setSent(true);
            setCooldown(60);
          } else if (result.retryAfterSeconds) {
            setCooldown(result.retryAfterSeconds);
          }
        }}
      >
        {cooldown > 0 ? t("auth.code.resendIn", { seconds: cooldown }) : t("auth.code.resend")}
      </Button>
      {sent && <Text>{t("auth.code.resent")}</Text>}
    </View>
  );
}

export const formStyles = StyleSheet.create({
  screen: { flexGrow: 1, padding: 24, gap: 12, justifyContent: "center" },
  title: { marginBottom: 8 },
});

const styles = StyleSheet.create({
  code: { fontSize: 24, letterSpacing: 8, textAlign: "center" },
});
