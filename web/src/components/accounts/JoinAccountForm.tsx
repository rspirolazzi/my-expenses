"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { acceptInvitationAction, previewInvitationAction } from "@/app/actions/accounts";
import { ErrorMessage } from "@/components/FormMessage";
import type { ApiErrorCode } from "@/lib/api/errors";
import type { InvitationPreview } from "@/lib/api/types";
import { isValidParticipantName, PARTICIPANT_NAME_MAX } from "@/lib/participantNames";

import { AccountIcon } from "./AccountIcon";

interface JoinAccountFormProps {
  code: string;
  initialPreview: InvitationPreview;
}

/** Pick which participant you are, or add yourself (FR-010). */
export function JoinAccountForm({ code, initialPreview }: JoinAccountFormProps) {
  const t = useTranslations("invite");
  const router = useRouter();
  const [preview, setPreview] = useState(initialPreview);
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  async function join(choice: { participantId: string } | { newParticipantName: string }) {
    setPending(true);
    setError(null);
    const result = await acceptInvitationAction(code, choice);
    setPending(false);
    if (result.ok) {
      router.push(`/accounts/${result.data.id}`);
      router.refresh();
      return;
    }
    setError(result.code);
    if (result.code === "participant_taken" || result.code === "already_member") {
      const refreshed = await previewInvitationAction(code);
      if (refreshed.ok) setPreview(refreshed.data);
      setSelected(null);
    }
  }

  if (preview.alreadyMember && preview.accountId) {
    return (
      <div className="form">
        <p role="status">{t("alreadyMember")}</p>
        <Link href={`/accounts/${preview.accountId}`} className="button">
          {t("open")}
        </Link>
      </div>
    );
  }

  function submitNew(event: FormEvent) {
    event.preventDefault();
    if (isValidParticipantName(newName)) void join({ newParticipantName: newName.trim() });
  }

  return (
    <div className="form">
      <header className="row">
        <AccountIcon icon={preview.icon} size="2rem" />
        <div>
          <h1>{t("title", { name: preview.accountName })}</h1>
          <small>{t("currency", { currency: preview.currency })}</small>
        </div>
      </header>
      {preview.availableParticipants.length > 0 ? (
        <fieldset className="form">
          <legend>{t("choose")}</legend>
          {preview.availableParticipants.map((p) => (
            <label key={p.id} className="row">
              <input
                type="radio"
                name="participant"
                value={p.id}
                checked={selected === p.id}
                onChange={() => setSelected(p.id)}
              />
              {p.name}
            </label>
          ))}
          <button
            type="button"
            disabled={!selected || pending}
            onClick={() => selected && join({ participantId: selected })}
          >
            {t("join")}
          </button>
        </fieldset>
      ) : (
        <p>{t("noneAvailable")}</p>
      )}
      <form onSubmit={submitNew} className="form">
        <label htmlFor="join-new-name">{t("orNew")}</label>
        <div className="row">
          <input
            id="join-new-name"
            placeholder={t("newName")}
            maxLength={PARTICIPANT_NAME_MAX}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" disabled={pending || !isValidParticipantName(newName)}>
            {t("joinAsNew")}
          </button>
        </div>
      </form>
      <ErrorMessage code={error} />
    </div>
  );
}
