"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { credentialsSignInAction } from "@/app/actions/auth";
import type { ApiErrorCode } from "@/lib/api/errors";
import { withCallback } from "@/lib/pendingRedirect";
import { safeCallbackUrl } from "@/lib/safeCallbackUrl";
import { validateEmail } from "@/lib/validation";

import { ErrorMessage } from "./FormMessage";

interface LoginFormProps {
  callbackUrl?: string;
  /** Translation key for an error passed by Auth.js on the URL (e.g. a cancelled Google sign-in). */
  initialErrorKey?: string | null;
}

export function LoginForm({ callbackUrl, initialErrorKey }: LoginFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [lockedMinutes, setLockedMinutes] = useState<number | null>(null);
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLockedMinutes(null);
    const badEmail = validateEmail(email) !== null;
    setInvalidEmail(badEmail);
    if (badEmail || !password) return;

    setPending(true);
    const result = await credentialsSignInAction({
      mode: "password",
      email: email.trim(),
      password,
    });
    setPending(false);
    if (result.ok) {
      router.replace(safeCallbackUrl(callbackUrl));
      router.refresh();
      return;
    }
    if (result.code === "password_login_locked") {
      setLockedMinutes(Math.max(1, Math.ceil((result.retryAfterSeconds ?? 900) / 60)));
      return;
    }
    setError(result.code);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="form">
      {initialErrorKey && !error && (
        <p role="alert" className="form-error">
          {t(initialErrorKey)}
        </p>
      )}
      <div className="field">
        <label htmlFor="login-email">{t("common.email")}</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="login-password">{t("common.password")}</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {invalidEmail && (
        <p role="alert" className="form-error">
          {t("validation.emailInvalid")}
        </p>
      )}
      {lockedMinutes !== null && (
        <p role="alert" className="form-error">
          {t("auth.login.lockedMinutes", { minutes: lockedMinutes })}{" "}
          <Link href={withCallback("/login-code", callbackUrl)}>{t("auth.login.useCode")}</Link>
        </p>
      )}
      <ErrorMessage code={error} />
      <button type="submit" disabled={pending}>
        {t("auth.login.submit")}
      </button>
      <nav className="form-links">
        <Link href={withCallback("/login-code", callbackUrl)}>{t("auth.login.useCode")}</Link>
        <Link href="/forgot-password">{t("auth.login.forgot")}</Link>
        <span>
          {t("auth.login.noAccount")}{" "}
          <Link href={withCallback("/register", callbackUrl)}>{t("auth.login.register")}</Link>
        </span>
      </nav>
    </form>
  );
}
