"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { createSettlementAction } from "@/app/actions/settlements";
import type { ApiErrorCode } from "@/lib/api/errors";
import type { AccountResponse, SuggestedTransfer } from "@/lib/api/types";
import { today } from "@/lib/expenseGroups";
import { formatMoney } from "@/lib/money";

import { MarkPaidDialog } from "./MarkPaidDialog";

interface Open {
  suggestion: SuggestedTransfer;
  date: string;
  /** Stable across retries of the same dialog, so a lost response never records two. */
  clientRequestId: string;
}

/** Suggested settlements, each with "Marcar como pagado" unless the account is closed. */
export function SuggestionList({
  account,
  suggestions,
}: {
  account: AccountResponse;
  suggestions: SuggestedTransfer[];
}) {
  const t = useTranslations("balances");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState<Open | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiErrorCode | null>(null);

  const close = useCallback(() => {
    setOpen(null);
    setError(null);
  }, []);

  async function confirm() {
    if (!open) return;
    setPending(true);
    setError(null);
    const result = await createSettlementAction(
      account.id,
      {
        fromParticipantId: open.suggestion.from.id,
        toParticipantId: open.suggestion.to.id,
        amount: open.suggestion.amount,
        date: open.date,
        source: "suggestion",
      },
      open.clientRequestId,
    );
    setPending(false);
    if (!result.ok) {
      setError(result.code);
      return;
    }
    close();
    router.refresh();
  }

  return (
    <section className="stack" aria-labelledby="suggestions-title">
      <h2 id="suggestions-title">{t("suggestions")}</h2>
      {suggestions.length === 0 ? (
        <p>{t("nothingPending")}</p>
      ) : (
        <ul className="suggestion-list">
          {suggestions.map((suggestion) => (
            <li key={`${suggestion.from.id}-${suggestion.to.id}`} className="suggestion-row">
              <span>{t("transfer", { from: suggestion.from.name, to: suggestion.to.name })}</span>
              <span className="row">
                <strong>
                  {formatMoney(
                    suggestion.amount,
                    account.currency,
                    account.currencyDecimals,
                    locale,
                  )}
                </strong>
                {!account.isClosed && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setOpen({
                        suggestion,
                        date: today(),
                        clientRequestId: crypto.randomUUID(),
                      })
                    }
                  >
                    {t("markPaid")}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <MarkPaidDialog
        suggestion={open?.suggestion ?? null}
        currency={account.currency}
        decimals={account.currencyDecimals}
        date={open?.date ?? ""}
        pending={pending}
        error={error}
        onConfirm={confirm}
        onCancel={close}
      />
    </section>
  );
}
