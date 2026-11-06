"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type FormEvent, useState } from "react";

import {
  confirmEmailChangeAction,
  requestEmailChangeAction,
  updateMeAction,
} from "@/app/actions/profile";
import type { ApiErrorCode } from "@/lib/api/errors";
import type { LanguageCode, ThemeName, UserResponse } from "@/lib/api/types";
import { type ValidationKey, validateEmail, validateName } from "@/lib/validation";

import { CodeInput } from "./CodeInput";
import { CurrencySelect } from "./CurrencySelect";
import { ErrorMessage, StatusMessage } from "./FormMessage";

export function ProfileForm({ user }: { user: UserResponse }) {
  const t = useTranslations();
  const router = useRouter();
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [invalid, setInvalid] = useState<ValidationKey | null>(null);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setError(null);
    const problem = validateName(firstName) ?? validateName(lastName);
    setInvalid(problem);
    if (problem) return;
    setPending(true);
    // An emptied field is sent as null, which clears it.
    const result = await updateMeAction({
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.code);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="form">
      <h2>{t("profile.personal")}</h2>
      <div className="field">
        <label htmlFor="profile-first-name">{t("profile.firstName")}</label>
        <input
          id="profile-first-name"
          maxLength={60}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="profile-last-name">{t("profile.lastName")}</label>
        <input
          id="profile-last-name"
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
      {saved && <StatusMessage>{t("profile.saved")}</StatusMessage>}
      <button type="submit" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </button>
    </form>
  );
}

const THEMES: ThemeName[] = ["light", "dark", "system"];
const LANGUAGES: LanguageCode[] = ["es", "en"];

/** Language, theme and currency: applied locally at once, then persisted (FR-022, SC-004). */
export function PreferencesForm({ user }: { user: UserResponse }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const { setTheme } = useTheme();
  const [prefs, setPrefs] = useState(user.preferences);
  const [error, setError] = useState<ApiErrorCode | null>(null);

  async function change(patch: Partial<typeof prefs>) {
    const previous = prefs;
    setPrefs({ ...prefs, ...patch });
    setError(null);
    if (patch.theme) setTheme(patch.theme);

    const result = await updateMeAction({ preferences: patch });
    if (!result.ok) {
      setPrefs(previous);
      if (patch.theme) setTheme(previous.theme);
      setError(result.code);
      return;
    }
    // A new language re-renders the server components with the other message catalog.
    if (patch.language) router.refresh();
  }

  return (
    <section className="form">
      <h2>{t("preferences")}</h2>
      <div className="field">
        <label htmlFor="pref-language">{t("language")}</label>
        <select
          id="pref-language"
          value={prefs.language}
          onChange={(e) => change({ language: e.target.value as LanguageCode })}
        >
          {LANGUAGES.map((code) => (
            <option key={code} value={code}>
              {t(`languages.${code}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="pref-theme">{t("theme")}</label>
        <select
          id="pref-theme"
          value={prefs.theme}
          onChange={(e) => change({ theme: e.target.value as ThemeName })}
        >
          {THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {t(`themes.${theme}`)}
            </option>
          ))}
        </select>
      </div>
      <CurrencySelect
        id="pref-currency"
        label={t("currency")}
        value={prefs.defaultCurrency ?? ""}
        onChange={(code) => change({ defaultCurrency: code })}
      />
      <ErrorMessage code={error} />
    </section>
  );
}

export function EmailChangeForm({ user }: { user: UserResponse }) {
  const t = useTranslations();
  const router = useRouter();
  const [newEmail, setNewEmail] = useState("");
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [currentEmail, setCurrentEmail] = useState(user.email);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  async function handleRequest(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const bad = validateEmail(newEmail) !== null;
    setInvalid(bad);
    if (bad) return;
    setPending(true);
    const result = await requestEmailChangeAction(newEmail.trim());
    setPending(false);
    if (!result.ok) {
      setError(result.code);
      return;
    }
    setStep("code");
  }

  async function confirm(code: string) {
    setPending(true);
    setError(null);
    const result = await confirmEmailChangeAction(code);
    setPending(false);
    if (!result.ok) {
      setError(result.code);
      return;
    }
    setCurrentEmail(result.data.email);
    setStep("done");
    router.refresh();
  }

  return (
    <section className="form">
      <h2>{t("profile.email")}</h2>
      <p>
        {t("profile.currentEmail")}: <strong>{currentEmail}</strong>
      </p>
      {step === "email" && (
        <form onSubmit={handleRequest} noValidate>
          <div className="field">
            <label htmlFor="new-email">{t("profile.newEmail")}</label>
            <input
              id="new-email"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          {invalid && (
            <p role="alert" className="form-error">
              {t("validation.emailInvalid")}
            </p>
          )}
          <button type="submit" disabled={pending}>
            {t("profile.sendCode")}
          </button>
        </form>
      )}
      {step === "code" && (
        <div>
          <p>{t("profile.codeSentTo", { email: newEmail.trim() })}</p>
          <CodeInput label={t("profile.codeLabel")} onComplete={confirm} disabled={pending} />
        </div>
      )}
      {step === "done" && (
        <StatusMessage>{t("profile.emailChanged", { email: currentEmail })}</StatusMessage>
      )}
      <ErrorMessage code={error} />
    </section>
  );
}
