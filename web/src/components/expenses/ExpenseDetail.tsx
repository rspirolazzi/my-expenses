"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { deleteExpenseAction } from "@/app/actions/expenses";
import { ConfirmDialog } from "@/components/accounts/ConfirmDialog";
import { ErrorMessage } from "@/components/FormMessage";
import type { ApiErrorCode } from "@/lib/api/errors";
import type { AccountResponse, ExpenseResponse } from "@/lib/api/types";
import { formatDay } from "@/lib/expenseGroups";
import { formatMoney } from "@/lib/money";

import { CategoryIcon } from "./CategoryIcon";

interface ExpenseDetailProps {
  account: AccountResponse;
  expense: ExpenseResponse;
}

export function ExpenseDetail({ account, expense }: ExpenseDetailProps) {
  const t = useTranslations("expenses");
  const locale = useLocale();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [notice, setNotice] = useState<"conflict" | "gone" | null>(null);
  const money = (amount: string) =>
    formatMoney(amount, expense.currency, account.currencyDecimals, locale);
  const base = `/accounts/${account.id}`;

  async function remove() {
    setConfirming(false);
    setError(null);
    const result = await deleteExpenseAction(account.id, expense.id, expense.version);
    if (result.ok) {
      router.push(base);
      router.refresh();
    } else if (result.code === "expense_conflict") {
      setNotice("conflict");
      router.refresh();
    } else if (result.code === "not_found") {
      setNotice("gone");
    } else {
      setError(result.code);
    }
  }

  return (
    <section className="card stack">
      <header className="row space-between">
        <span className="row">
          <CategoryIcon icon={expense.categoryIcon} size="2rem" />
          <span>
            <h1>{expense.title}</h1>
            <small>{formatDay(expense.date, locale)}</small>
          </span>
        </span>
        <strong>{money(expense.amount)}</strong>
      </header>
      {expense.isPending && (
        <p role="status" className="badge">
          {t("pending")} · {t("detail.pendingHint")}
        </p>
      )}
      {notice && (
        <p role="alert" className="form-error">
          {t(notice)}
        </p>
      )}
      <dl className="detail-list">
        <dt>{t("detail.paidBy")}</dt>
        <dd>{expense.paidBy?.name ?? t("noPayer")}</dd>
        <dt>{t("detail.category")}</dt>
        <dd>{t(`categories.${expense.categoryIcon}`)}</dd>
        {expense.description && (
          <>
            <dt>{t("detail.description")}</dt>
            <dd>{expense.description}</dd>
          </>
        )}
      </dl>
      <section>
        <h2>{t("detail.shares")}</h2>
        <ul className="participant-list">
          {expense.shares.map((share) => (
            <li key={share.participant.id}>
              <span>{share.participant.name}</span>
              <span>{money(share.amount)}</span>
            </li>
          ))}
        </ul>
      </section>
      <ErrorMessage code={error} />
      <span className="row">
        {!account.isClosed && notice !== "gone" && (
          <>
            <Link href={`${base}/expenses/${expense.id}/edit`} className="button">
              {t("detail.edit")}
            </Link>
            <button type="button" className="danger" onClick={() => setConfirming(true)}>
              {t("detail.delete")}
            </button>
          </>
        )}
        <Link href={base}>{t("back")}</Link>
      </span>
      <ConfirmDialog
        open={confirming}
        title={t("dialogs.deleteTitle")}
        message={t("dialogs.deleteBody")}
        onCancel={() => setConfirming(false)}
        onConfirm={remove}
      />
    </section>
  );
}
