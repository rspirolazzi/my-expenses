"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

import { credentialsSignInAction, resendRegistrationAction } from "@/app/actions/auth";
import type { ApiErrorCode } from "@/lib/api/errors";
import { pendingEmailStore } from "@/lib/pendingEmail";

import { CodeInput, ResendButton } from "./CodeInput";
import { ErrorMessage } from "./FormMessage";

export function VerifyEmailForm() {
  const t = useTranslations("auth.verifyEmail");
  const router = useRouter();
  const email = useSyncExternalStore(...pendingEmailStore);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  async function verify(code: string) {
    setPending(true);
    setError(null);
    const result = await credentialsSignInAction({ mode: "verify-email", email, code });
    setPending(false);
    if (!result.ok) {
      setError(result.code);
      return;
    }
    // The proxy sends a new user to the currency onboarding (FR-020a).
    router.replace("/onboarding/currency");
    router.refresh();
  }

  // Without a pending email (e.g. a new tab) the user goes back to the registration form.
  if (!email) return <Link href="/register">{t("correctEmail")}</Link>;
  return (
    <div className="form">
      <p>{t("sentTo", { email })}</p>
      <CodeInput label={t("codeLabel")} onComplete={verify} disabled={pending} />
      <ErrorMessage code={error} />
      <ResendButton
        onResend={() => resendRegistrationAction(email)}
        onError={(result) => setError(result.code)}
      />
      <Link href="/register">{t("correctEmail")}</Link>
    </div>
  );
}
