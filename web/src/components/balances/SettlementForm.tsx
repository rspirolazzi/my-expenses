"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { createSettlementAction, type SettlementInput } from "@/app/actions/settlements";
import { ErrorMessage } from "@/components/FormMessage";
import type { ApiErrorCode } from "@/lib/api/errors";
import type { AccountResponse } from "@/lib/api/types";
import { today } from "@/lib/expenseGroups";
import { type AmountError, parseAmountInput } from "@/lib/money";
import { useHydrated } from "@/lib/useHydrated";

type FieldError = AmountError | "fromRequired" | "toRequired" | "sameParticipant" | "dateRequired";

const SETTLEMENT_ERRORS = new Set([
  "fromRequired",
  "toRequired",
  "sameParticipant",
  "dateRequired",
]);

/** Manual settlement between two active participants (FR-013); it always starts empty. */
export function SettlementForm({ account }: { account: AccountResponse }) {
  const t = useTranslations("settlements");
  const tExpenses = useTranslations("expenses");
  const locale = useLocale();
  const router = useRouter();
  const hydrated = useHydrated();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  // Stable across retries of the same form, so a lost response never records two (FR-018).
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [apiError, setApiError] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const decimals = account.currencyDecimals;
  // "Today" depends on the device's time zone: only computed after hydration.
  const date = chosenDate ?? (hydrated ? today() : "");

  function validate(): { input: SettlementInput } | { error: FieldError } {
    if (!fromId) return { error: "fromRequired" };
    if (!toId) return { error: "toRequired" };
    if (fromId === toId) return { error: "sameParticipant" };
    const parsed = parseAmountInput(amount, locale, decimals);
    if (!parsed.ok) return { error: parsed.error };
    if (!date) return { error: "dateRequired" };
    return {
      input: {
        fromParticipantId: fromId,
        toParticipantId: toId,
        amount: parsed.value,
        date,
        source: "manual",
      },
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setApiError(null);
    const checked = validate();
    if ("error" in checked) {
      setFieldError(checked.error);
      return;
    }
    setFieldError(null);
    setPending(true);
    const result = await createSettlementAction(account.id, checked.input, clientRequestId);
    setPending(false);
    if (result.ok) {
      router.push(`/accounts/${account.id}/balances`);
      router.refresh();
      return;
    }
    setApiError(result.code);
  }

  const fieldMessage =
    fieldError === null
      ? null
      : SETTLEMENT_ERRORS.has(fieldError)
        ? t(`validation.${fieldError}`)
        : tExpenses(`validation.${fieldError}`, { decimals });

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="settlement-from">{t("from")}</label>
        <select id="settlement-from" value={fromId} onChange={(e) => setFromId(e.target.value)}>
          <option value="">{t("chooseFrom")}</option>
          {account.participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="settlement-to">{t("to")}</label>
        <select id="settlement-to" value={toId} onChange={(e) => setToId(e.target.value)}>
          <option value="">{t("chooseTo")}</option>
          {account.participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="settlement-amount">{t("amount", { currency: account.currency })}</label>
        <input
          id="settlement-amount"
          inputMode={decimals === 0 ? "numeric" : "decimal"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <small>{t("currencyHint")}</small>
      </div>
      <div className="field">
        <label htmlFor="settlement-date">{t("date")}</label>
        <input
          id="settlement-date"
          type="date"
          value={date}
          onChange={(e) => setChosenDate(e.target.value)}
          required
        />
      </div>
      {fieldMessage && (
        <p role="alert" className="form-error">
          {fieldMessage}
        </p>
      )}
      <ErrorMessage code={apiError} />
      <button type="submit" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
