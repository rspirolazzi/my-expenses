"use client";

import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

import { regenerateInviteAction } from "@/app/actions/accounts";
import { ErrorMessage, StatusMessage } from "@/components/FormMessage";
import type { ApiErrorCode } from "@/lib/api/errors";
import type { AccountResponse } from "@/lib/api/types";

import { ConfirmDialog } from "./ConfirmDialog";

const noopSubscribe = () => () => undefined;

export function inviteUrl(origin: string, code: string): string {
  return `${origin}/invite/${code}`;
}

interface InvitePanelProps {
  account: AccountResponse;
  onChange: (account: AccountResponse) => void;
}

/** Any member can see and share the link; only the Owner can regenerate it (FR-008). */
export function InvitePanel({ account, onChange }: InvitePanelProps) {
  const t = useTranslations("accounts");
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const url = inviteUrl(origin, account.inviteCode);

  if (account.isClosed) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function regenerate() {
    setConfirming(false);
    setCopied(false);
    const result = await regenerateInviteAction(account.id);
    if (!result.ok) return setError(result.code);
    onChange(result.data);
  }

  return (
    <section className="form">
      <h2>{t("invite.title")}</h2>
      <p>{t("invite.hint")}</p>
      <input
        readOnly
        aria-label={t("invite.title")}
        value={url}
        onFocus={(e) => e.target.select()}
      />
      <small>{t("invite.code", { code: account.inviteCode })}</small>
      <div className="row">
        <button type="button" onClick={copy}>
          {t("invite.copy")}
        </button>
        {account.isOwner && (
          <button type="button" className="secondary" onClick={() => setConfirming(true)}>
            {t("invite.regenerate")}
          </button>
        )}
      </div>
      {copied && <StatusMessage>{t("invite.copied")}</StatusMessage>}
      <ErrorMessage code={error} />
      <ConfirmDialog
        open={confirming}
        title={t("dialogs.regenerateTitle")}
        message={t("dialogs.regenerateBody")}
        onCancel={() => setConfirming(false)}
        onConfirm={regenerate}
      />
    </section>
  );
}
