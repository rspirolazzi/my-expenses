"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState, useSyncExternalStore } from "react";

import { registerAction } from "@/app/actions/auth";
import type { ApiErrorCode } from "@/lib/api/errors";
import { pendingEmailStore, savePendingEmail } from "@/lib/pendingEmail";
import { savePendingRedirect } from "@/lib/pendingRedirect";
import {
  type ValidationKey,
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/validation";

import { ErrorMessage } from "./FormMessage";

export function RegisterForm({ callbackUrl }: { callbackUrl?: string } = {}) {
  const t = useTranslations();
  const router = useRouter();
  // "Fix the email" comes back here with the previous email filled in.
  const storedEmail = useSyncExternalStore(...pendingEmailStore);
  const [typedEmail, setEmail] = useState<string | null>(null);
  const email = typedEmail ?? storedEmail;
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [invalid, setInvalid] = useState<ValidationKey | null>(null);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem =
      validateEmail(email) ??
      validatePassword(password, email) ??
      validateName(firstName) ??
      validateName(lastName);
    setInvalid(problem);
    setError(null);
    if (problem) return;

    setPending(true);
    const result = await registerAction({ email: email.trim(), password, firstName, lastName });
    setPending(false);
    if (!result.ok) {
      setError(result.code);
      return;
    }
    savePendingEmail(email.trim());
    savePendingRedirect(callbackUrl);
    router.push("/verify-email");
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="form">
      <div className="field">
        <label htmlFor="register-email">{t("common.email")}</label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="register-password">{t("common.password")}</label>
        <input
          id="register-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <small>{t("auth.register.passwordHint")}</small>
      </div>
      <div className="field">
        <label htmlFor="register-first-name">{t("auth.register.firstName")}</label>
        <input
          id="register-first-name"
          autoComplete="given-name"
          maxLength={60}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="register-last-name">{t("auth.register.lastName")}</label>
        <input
          id="register-last-name"
          autoComplete="family-name"
          maxLength={60}
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>
      {invalid && (
        <p role="alert" className="form-error">
          {t(`validation.${invalid}`)}
        </p>
      )}
      <ErrorMessage code={error} />
      <button type="submit" disabled={pending}>
        {t("auth.register.submit")}
      </button>
      <p>
        {t("auth.register.haveAccount")} <Link href="/login">{t("auth.register.login")}</Link>
      </p>
    </form>
  );
}
