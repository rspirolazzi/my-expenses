"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import {
  createExpenseAction,
  type ExpenseInput,
  updateExpenseAction,
} from "@/app/actions/expenses";
import { ErrorMessage } from "@/components/FormMessage";
import type { ApiErrorCode } from "@/lib/api/errors";
import type { AccountResponse, CategoryIcon, ExpenseResponse } from "@/lib/api/types";
import { DEFAULT_CATEGORY } from "@/lib/categoryIcons";
import { today } from "@/lib/expenseGroups";
import { type AmountError, amountToInput, parseAmountInput } from "@/lib/money";
import { useHydrated } from "@/lib/useHydrated";

import { CategoryPicker } from "./CategoryIcon";

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 500;

type FieldError =
  | AmountError
  | "titleRequired"
  | "payerRequired"
  | "participantsRequired"
  | "descriptionTooLong"
  | "dateRequired";

interface ExpenseFormProps {
  account: AccountResponse;
  /** Present when editing. */
  expense?: ExpenseResponse;
}

function initialState(
  account: AccountResponse,
  expense: ExpenseResponse | undefined,
  locale: string,
) {
  const active = new Set(account.participants.map((p) => p.id));
  return {
    date: expense?.date ?? null,
    title: expense?.title ?? "",
    amount: expense ? amountToInput(expense.amount, locale) : "",
    paidById: expense ? (expense.paidBy?.id ?? "") : account.myParticipantId,
    participantIds: expense
      ? expense.participants.map((p) => p.id).filter((id) => active.has(id))
      : account.participants.map((p) => p.id),
    categoryIcon: (expense?.categoryIcon ?? DEFAULT_CATEGORY) as CategoryIcon,
    description: expense?.description ?? "",
  };
}

export function ExpenseForm({ account, expense }: ExpenseFormProps) {
  const t = useTranslations("expenses");
  const locale = useLocale();
  const router = useRouter();
  const hydrated = useHydrated();
  const [state, setState] = useState(() => initialState(account, expense, locale));
  const [version, setVersion] = useState(expense?.version ?? 0);
  // Stable across retries of the same form, so a lost response never creates two (research R7).
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [apiError, setApiError] = useState<ApiErrorCode | null>(null);
  const [notice, setNotice] = useState<"conflict" | "gone" | null>(null);
  const [pending, setPending] = useState(false);
  const decimals = account.currencyDecimals;
  // "Today" depends on the device's time zone: only computed after hydration (research R3).
  const date = state.date ?? (hydrated ? today() : "");

  function set<K extends keyof typeof state>(key: K, value: (typeof state)[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function toggleParticipant(id: string) {
    set(
      "participantIds",
      state.participantIds.includes(id)
        ? state.participantIds.filter((p) => p !== id)
        : [...state.participantIds, id],
    );
  }

  function validate(): { input: ExpenseInput } | { error: FieldError } {
    if (!date) return { error: "dateRequired" };
    const title = state.title.trim();
    if (!title || title.length > TITLE_MAX) return { error: "titleRequired" };
    const amount = parseAmountInput(state.amount, locale, decimals);
    if (!amount.ok) return { error: amount.error };
    if (!state.paidById) return { error: "payerRequired" };
    if (state.participantIds.length === 0) return { error: "participantsRequired" };
    const description = state.description.trim();
    if (description.length > DESCRIPTION_MAX) return { error: "descriptionTooLong" };
    return {
      input: {
        date,
        title,
        description: description || null,
        amount: amount.value,
        paidById: state.paidById,
        participantIds: state.participantIds,
        categoryIcon: state.categoryIcon,
      },
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setApiError(null);
    setNotice(null);
    const checked = validate();
    if ("error" in checked) {
      setFieldError(checked.error);
      return;
    }
    setFieldError(null);
    setPending(true);
    const result = expense
      ? await updateExpenseAction(account.id, expense.id, checked.input, version)
      : await createExpenseAction(account.id, checked.input, clientRequestId);
    setPending(false);
    if (result.ok) {
      router.push(`/accounts/${account.id}/expenses/${result.data.id}`);
      router.refresh();
      return;
    }
    if (result.code === "expense_conflict" && result.details?.current) {
      const current = result.details.current as ExpenseResponse;
      setState(initialState(account, current, locale));
      setVersion(current.version);
      setNotice("conflict");
      return;
    }
    if (expense && result.code === "not_found") {
      setNotice("gone");
      return;
    }
    setApiError(result.code);
  }

  if (notice === "gone") {
    return (
      <div className="stack">
        <p role="alert" className="form-error">
          {t("gone")}
        </p>
        <Link href={`/accounts/${account.id}`}>{t("back")}</Link>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      {notice === "conflict" && (
        <p role="alert" className="form-error">
          {t("conflict")}
        </p>
      )}
      <div className="field">
        <label htmlFor="expense-date">{t("form.date")}</label>
        <input
          id="expense-date"
          type="date"
          value={date}
          onChange={(e) => set("date", e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="expense-title">{t("form.title")}</label>
        <input
          id="expense-title"
          value={state.title}
          maxLength={TITLE_MAX}
          onChange={(e) => set("title", e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="expense-amount">{t("form.amount", { currency: account.currency })}</label>
        <input
          id="expense-amount"
          inputMode={decimals === 0 ? "numeric" : "decimal"}
          value={state.amount}
          onChange={(e) => set("amount", e.target.value)}
          required
        />
        <small>{t("form.currencyHint")}</small>
      </div>
      <div className="field">
        <label htmlFor="expense-payer">{t("form.paidBy")}</label>
        <select
          id="expense-payer"
          value={state.paidById}
          onChange={(e) => set("paidById", e.target.value)}
        >
          <option value="" disabled>
            {t("form.choosePayer")}
          </option>
          {account.participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="field">
        <legend>{t("form.participants")}</legend>
        {account.participants.map((p) => (
          <label key={p.id} className="row">
            <input
              type="checkbox"
              checked={state.participantIds.includes(p.id)}
              onChange={() => toggleParticipant(p.id)}
            />
            {p.name}
          </label>
        ))}
      </fieldset>
      <CategoryPicker value={state.categoryIcon} onChange={(icon) => set("categoryIcon", icon)} />
      <div className="field">
        <label htmlFor="expense-description">{t("form.description")}</label>
        <textarea
          id="expense-description"
          value={state.description}
          maxLength={DESCRIPTION_MAX}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>
      {fieldError && (
        <p role="alert" className="form-error">
          {t(`validation.${fieldError}`, { decimals })}
        </p>
      )}
      <ErrorMessage code={apiError} />
      <span className="row">
        <button type="submit" disabled={pending}>
          {pending ? t("form.saving") : t("form.save")}
        </button>
        <Link
          href={
            expense ? `/accounts/${account.id}/expenses/${expense.id}` : `/accounts/${account.id}`
          }
        >
          {t("back")}
        </Link>
      </span>
    </form>
  );
}
