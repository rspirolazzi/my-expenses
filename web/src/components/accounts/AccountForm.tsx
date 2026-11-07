"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { createAccountAction } from "@/app/actions/accounts";
import { CurrencySelect } from "@/components/CurrencySelect";
import { ErrorMessage } from "@/components/FormMessage";
import { DEFAULT_ACCOUNT_ICON } from "@/lib/accountIcons";
import type { ApiErrorCode } from "@/lib/api/errors";
import type { AccountIcon } from "@/lib/api/types";
import {
  ACCOUNT_NAME_MAX,
  hasDuplicateNames,
  isValidAccountName,
  isValidParticipantName,
  PARTICIPANT_NAME_MAX,
} from "@/lib/participantNames";

import { IconPicker } from "./AccountIcon";

interface AccountFormProps {
  /** The user's default currency (FR-003) and visible name (FR-004). */
  defaultCurrency: string | null;
  myName: string;
}

export function AccountForm({ defaultCurrency, myName }: AccountFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<AccountIcon>(DEFAULT_ACCOUNT_ICON);
  const [currency, setCurrency] = useState(defaultCurrency ?? "");
  const [me, setMe] = useState(myName.slice(0, PARTICIPANT_NAME_MAX));
  const [others, setOthers] = useState<string[]>([""]);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const otherNames = others.map((o) => o.trim()).filter(Boolean);
    const names = [me, ...otherNames];
    if (!isValidAccountName(name)) return setProblem("accounts.form.nameRequired");
    if (!names.every(isValidParticipantName)) return setProblem("accounts.form.participantInvalid");
    if (hasDuplicateNames(names)) return setProblem("accounts.form.duplicateNames");
    setProblem(null);

    setPending(true);
    const result = await createAccountAction({
      name: name.trim(),
      description,
      icon,
      currency,
      myParticipantName: me.trim(),
      otherParticipants: otherNames,
    });
    setPending(false);
    if (!result.ok) return setError(result.code);
    router.push(`/accounts/${result.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="form">
      <div className="field">
        <label htmlFor="account-name">{t("accounts.form.name")}</label>
        <input
          id="account-name"
          maxLength={ACCOUNT_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="account-description">{t("accounts.form.description")}</label>
        <textarea
          id="account-description"
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <IconPicker value={icon} onChange={setIcon} />
      <CurrencySelect
        id="account-currency"
        label={t("accounts.form.currency")}
        value={currency}
        onChange={setCurrency}
      />
      <small>{t("accounts.form.currencyHint")}</small>
      <div className="field">
        <label htmlFor="account-me">{t("accounts.form.me")}</label>
        <input
          id="account-me"
          maxLength={PARTICIPANT_NAME_MAX}
          value={me}
          onChange={(e) => setMe(e.target.value)}
        />
      </div>
      <fieldset className="field">
        <legend>{t("accounts.form.others")}</legend>
        {others.map((value, index) => (
          <div key={index} className="row">
            <input
              aria-label={`${t("accounts.form.participantPlaceholder")} ${index + 1}`}
              placeholder={t("accounts.form.participantPlaceholder")}
              maxLength={PARTICIPANT_NAME_MAX}
              value={value}
              onChange={(e) => setOthers(others.map((o, i) => (i === index ? e.target.value : o)))}
            />
            <button
              type="button"
              className="link-button"
              aria-label={`${t("accounts.form.removeRow")} ${index + 1}`}
              onClick={() => setOthers(others.filter((_, i) => i !== index))}
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="link-button" onClick={() => setOthers([...others, ""])}>
          {t("accounts.form.addParticipant")}
        </button>
      </fieldset>
      {problem && (
        <p role="alert" className="form-error">
          {t(problem)}
        </p>
      )}
      <ErrorMessage code={error} />
      <button type="submit" disabled={pending || !currency}>
        {t("accounts.form.create")}
      </button>
    </form>
  );
}
