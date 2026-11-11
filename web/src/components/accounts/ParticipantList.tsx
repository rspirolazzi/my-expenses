"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import {
  addParticipantAction,
  removeParticipantAction,
  renameParticipantAction,
} from "@/app/actions/accounts";
import { participantImpactAction } from "@/app/actions/expenses";
import { ErrorMessage } from "@/components/FormMessage";
import type { ApiErrorCode } from "@/lib/api/errors";
import type { AccountResponse, ParticipantResponse } from "@/lib/api/types";
import { isValidParticipantName, PARTICIPANT_NAME_MAX } from "@/lib/participantNames";

import { ConfirmDialog } from "./ConfirmDialog";

interface ParticipantListProps {
  account: AccountResponse;
  onChange: (account: AccountResponse) => void;
  /** Called when the current user removed their own participant and is no longer a member. */
  onRemovedSelf: () => void;
}

export function ParticipantList({ account, onChange, onRemovedSelf }: ParticipantListProps) {
  const t = useTranslations("accounts");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newName, setNewName] = useState("");
  const [toRemove, setToRemove] = useState<ParticipantResponse | null>(null);
  // Affected expenses for the removal dialog (FR-022): a number, or null if it could not be read.
  const [impact, setImpact] = useState<number | null>(null);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const readOnly = account.isClosed;

  async function apply(
    action: () => Promise<{ ok: true; data: AccountResponse } | { ok: false; code: ApiErrorCode }>,
  ) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (!result.ok) {
      if (result.code === "not_found") onRemovedSelf();
      else setError(result.code);
      return false;
    }
    onChange(result.data);
    return true;
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!isValidParticipantName(newName)) return;
    if (await apply(() => addParticipantAction(account.id, newName.trim()))) setNewName("");
  }

  async function rename(participant: ParticipantResponse) {
    if (!isValidParticipantName(draft)) return;
    if (await apply(() => renameParticipantAction(account.id, participant.id, draft.trim()))) {
      setEditingId(null);
    }
  }

  async function askRemove(participant: ParticipantResponse) {
    const result = await participantImpactAction(account.id, participant.id);
    setImpact(result.ok ? result.data.affectedExpenses : null);
    setToRemove(participant);
  }

  async function confirmRemove() {
    if (!toRemove) return;
    const target = toRemove;
    setToRemove(null);
    await apply(() => removeParticipantAction(account.id, target.id));
  }

  return (
    <section className="form">
      <h2>{t("detail.participants")}</h2>
      <ul className="participant-list">
        {account.participants.map((p) => (
          <li key={p.id}>
            {editingId === p.id ? (
              <span className="row">
                <input
                  aria-label={t("detail.rename")}
                  maxLength={PARTICIPANT_NAME_MAX}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button type="button" disabled={pending} onClick={() => rename(p)}>
                  {t("form.save")}
                </button>
              </span>
            ) : (
              <span>
                {p.name}
                {p.isMe && <small> ({t("detail.you")})</small>}
                {p.isOwner && <small> · {t("detail.owner")}</small>}
                {p.isLinked && !p.isMe && <small> · {t("detail.linked")}</small>}
              </span>
            )}
            {!readOnly && editingId !== p.id && (
              <span className="row">
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setEditingId(p.id);
                    setDraft(p.name);
                  }}
                >
                  {t("detail.rename")}
                </button>
                {!p.isOwner && (
                  <button type="button" className="link-button" onClick={() => askRemove(p)}>
                    {t("detail.remove")}
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <form onSubmit={add} className="row">
          <input
            aria-label={t("form.addParticipant")}
            placeholder={t("form.participantPlaceholder")}
            maxLength={PARTICIPANT_NAME_MAX}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" disabled={pending}>
            {t("detail.add")}
          </button>
        </form>
      )}
      <ErrorMessage code={error} />
      <ConfirmDialog
        open={toRemove !== null}
        title={t("dialogs.removeTitle", { name: toRemove?.name ?? "" })}
        message={`${t("dialogs.removeBody")} ${
          impact === null
            ? t("dialogs.removeImpactUnknown")
            : t("dialogs.removeImpact", { count: impact })
        }`}
        onCancel={() => setToRemove(null)}
        onConfirm={confirmRemove}
      />
    </section>
  );
}
