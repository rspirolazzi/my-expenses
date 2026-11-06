"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import {
  credentialsSignInAction,
  requestLoginCodeAction,
  requestPasswordResetAction,
} from "@/app/actions/auth";
import type { ApiErrorCode } from "@/lib/api/errors";
import { type ValidationKey, validateEmail, validatePassword } from "@/lib/validation";

import { CodeInput, ResendButton } from "./CodeInput";
import { ErrorMessage } from "./FormMessage";

interface CodeSignInFlowProps {
  /** `login-code` (US3) or `password-reset` (US4, also asks for the new password). */
  kind: "login-code" | "password-reset";
}

/** Two steps: ask for the email and send a code; then sign in with the code. */
export function CodeSignInFlow({ kind }: CodeSignInFlowProps) {
  const t = useTranslations();
  const ns = kind === "login-code" ? "auth.loginCode" : "auth.forgotPassword";
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [invalid, setInvalid] = useState<ValidationKey | null>(null);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  const request = kind === "login-code" ? requestLoginCodeAction : requestPasswordResetAction;

  async function handleRequest(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const problem = validateEmail(email);
    setInvalid(problem);
    if (problem) return;
    setPending(true);
    const result = await request(email.trim());
    setPending(false);
    if (!result.ok) {
      setError(result.code);
      return;
    }
    setStep("code");
  }

  async function signInWith(codeValue: string) {
    setError(null);
    if (kind === "password-reset") {
      const problem = validatePassword(password, email);
      setInvalid(problem);
      if (problem) return;
    }
    setPending(true);
    const result = await credentialsSignInAction({
      mode: kind,
      email: email.trim(),
      code: codeValue,
      password: kind === "password-reset" ? password : undefined,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.code);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  if (step === "email") {
    return (
      <form onSubmit={handleRequest} noValidate className="form">
        <p>{t(`${ns}.intro`)}</p>
        <div className="field">
          <label htmlFor={`${kind}-email`}>{t("common.email")}</label>
          <input
            id={`${kind}-email`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {invalid && (
          <p role="alert" className="form-error">
            {t(`validation.${invalid}`)}
          </p>
        )}
        <ErrorMessage code={error} />
        <button type="submit" disabled={pending}>
          {t(`${ns}.request`)}
        </button>
      </form>
    );
  }

  return (
    <form
      noValidate
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        void signInWith(code);
      }}
    >
      <p>{t(`${ns}.sentTo`, { email: email.trim() })}</p>
      <CodeInput
        label={t(`${ns}.codeLabel`)}
        disabled={pending}
        onComplete={(value) => {
          setCode(value);
          if (kind === "login-code") void signInWith(value);
        }}
      />
      {kind === "password-reset" && (
        <div className="field">
          <label htmlFor="reset-password">{t("auth.forgotPassword.newPassword")}</label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      )}
      {invalid && (
        <p role="alert" className="form-error">
          {t(`validation.${invalid}`)}
        </p>
      )}
      <ErrorMessage code={error} />
      <button type="submit" disabled={pending || code.length !== 6}>
        {t(`${ns}.submit`)}
      </button>
      <ResendButton onResend={() => request(email.trim())} onError={(r) => setError(r.code)} />
    </form>
  );
}
