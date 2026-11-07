"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { updateAccountAction } from "@/app/actions/accounts";
import { ErrorMessage, StatusMessage } from "@/components/FormMessage";
import type { ApiErrorCode } from "@/lib/api/errors";
import type { AccountIcon, AccountResponse } from "@/lib/api/types";
import { ACCOUNT_NAME_MAX, isValidAccountName } from "@/lib/participantNames";

import { IconPicker } from "./AccountIcon";

interface AccountEditFormProps {
  account: AccountResponse;
  onChange: (account: AccountResponse) => void;
}

export function AccountEditForm({ account, onChange }: AccountEditFormProps) {
  const t = useTranslations("accounts");
  const [name, setName] = useState(account.name);
  const [description, setDescription] = useState(account.description ?? "");
  const [icon, setIcon] = useState<AccountIcon>(account.icon);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const readOnly = account.isClosed;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setError(null);
    const bad = !isValidAccountName(name);
    setInvalid(bad);
    if (bad) return;
    setPending(true);
    const result = await updateAccountAction(account.id, {
      name: name.trim(),
      description: description.trim() || null,
      icon,
    });
    setPending(false);
    if (!result.ok) return setError(result.code);
    onChange(result.data);
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="form">
      <h2>{t("detail.edit")}</h2>
      <fieldset disabled={readOnly} className="form">
        <div className="field">
          <label htmlFor="edit-account-name">{t("form.name")}</label>
          <input
            id="edit-account-name"
            maxLength={ACCOUNT_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="edit-account-description">{t("form.description")}</label>
          <textarea
            id="edit-account-description"
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <IconPicker value={icon} onChange={setIcon} />
        {invalid && (
          <p role="alert" className="form-error">
            {t("form.nameRequired")}
          </p>
        )}
        <ErrorMessage code={error} />
        {saved && <StatusMessage>{t("form.saved")}</StatusMessage>}
        {!readOnly && (
          <button type="submit" disabled={pending}>
            {t("form.save")}
          </button>
        )}
      </fieldset>
    </form>
  );
}
