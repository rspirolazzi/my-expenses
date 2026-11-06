import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "react-native-paper";

import { useAuth } from "../hooks/useAuth";
import { errorCodeOf } from "../services/api/types";
import { signInWithGoogle } from "../services/auth/googleSignIn";

interface GoogleSignInButtonProps {
  /** Receives a translation key to show (cancellation or API error), or null to clear it. */
  onMessage: (messageKey: string | null) => void;
}

export function GoogleSignInButton({ onMessage }: GoogleSignInButtonProps) {
  const { t } = useTranslation();
  const { signInWithTokens } = useAuth();
  const [pending, setPending] = useState(false);

  async function handlePress() {
    onMessage(null);
    setPending(true);
    try {
      const result = await signInWithGoogle();
      if (result.cancelled) onMessage("auth.google.cancelled");
      else await signInWithTokens(result.auth);
    } catch (error) {
      onMessage(`errors.${errorCodeOf(error)}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button mode="outlined" loading={pending} disabled={pending} onPress={handlePress}>
      {t("auth.google.button")}
    </Button>
  );
}
