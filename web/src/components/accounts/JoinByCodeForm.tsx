"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

/** Accepts the bare code or a pasted invitation link and opens /invite/<code>. */
export function extractInviteCode(value: string): string | null {
  const trimmed = value.trim();
  const fromLink = trimmed.match(/invite\/([A-Za-z0-9_-]+)/);
  const code = fromLink ? fromLink[1] : trimmed;
  return /^[A-Za-z0-9_-]{8,64}$/.test(code) ? code : null;
}

export function JoinByCodeForm() {
  const t = useTranslations();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const code = extractInviteCode(value);
    setInvalid(code === null);
    if (code) router.push(`/invite/${code}`);
  }

  return (
    <form onSubmit={submit} noValidate className="form">
      <div className="field">
        <label htmlFor="invite-code">{t("invite.codeLabel")}</label>
        <input id="invite-code" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      {invalid && (
        <p role="alert" className="form-error">
          {t("errors.invalid_invitation")}
        </p>
      )}
      <button type="submit">{t("invite.continue")}</button>
    </form>
  );
}
