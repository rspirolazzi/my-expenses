"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { deleteSettlementAction, loadMoreSettlementsAction } from "@/app/actions/settlements";
import { ConfirmDialog } from "@/components/accounts/ConfirmDialog";
import { ErrorMessage } from "@/components/FormMessage";
import type { ApiErrorCode } from "@/lib/api/errors";
import type { AccountResponse, SettlementPage, SettlementResponse } from "@/lib/api/types";
import { formatDay } from "@/lib/expenseGroups";
import { formatMoney } from "@/lib/money";

interface SettlementListProps {
  account: AccountResponse;
  firstPage: SettlementPage;
}

function merge(existing: SettlementResponse[], page: SettlementResponse[]) {
  const seen = new Set(existing.map((item) => item.id));
  return [...existing, ...page.filter((item) => !seen.has(item.id))];
}

/**
 * Active settlements, most recent first, 50 at a time (FR-015). Those of a removed participant
 * stay listed and marked; any member deletes one after confirming (FR-016).
 */
export function SettlementList({ account, firstPage }: SettlementListProps) {
  const t = useTranslations("settlements");
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(firstPage.items);
  const [cursor, setCursor] = useState(firstPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [gone, setGone] = useState(false);
  const [toDelete, setToDelete] = useState<SettlementResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    const result = await loadMoreSettlementsAction(account.id, cursor);
    setLoading(false);
    if (!result.ok) {
      setError(result.code);
      return;
    }
    setItems((current) => merge(current, result.data.items));
    setCursor(result.data.nextCursor);
  }

  const cancelDelete = useCallback(() => setToDelete(null), []);

  async function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    setDeleting(true);
    setError(null);
    setGone(false);
    const result = await deleteSettlementAction(account.id, target.id);
    setDeleting(false);
    setToDelete(null);
    if (result.ok || result.code === "not_found") {
      setItems((current) => current.filter((item) => item.id !== target.id));
      if (!result.ok) setGone(true);
      router.refresh();
      return;
    }
    setError(result.code);
  }

  return (
    <section className="stack" aria-labelledby="settlements-title">
      <h2 id="settlements-title">{t("title")}</h2>
      {gone && (
        <p role="alert" className="form-error">
          {t("gone")}
        </p>
      )}
      {items.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul className="settlement-list">
          {items.map((item) => (
            <li
              key={item.id}
              className={item.isExcluded ? "settlement-row excluded" : "settlement-row"}
            >
              <span className="stack">
                <span>{t("row", { from: item.from.name, to: item.to.name })}</span>
                <small>
                  {formatDay(item.date, locale, { dateStyle: "medium" })}
                  {item.isExcluded && (
                    <>
                      {" "}
                      <span className="badge" title={t("removedHint")}>
                        {t("removed")}
                      </span>
                    </>
                  )}
                </small>
              </span>
              <span className="row">
                <strong>
                  {formatMoney(item.amount, account.currency, account.currencyDecimals, locale)}
                </strong>
                {!account.isClosed && (
                  <button type="button" className="secondary" onClick={() => setToDelete(item)}>
                    {t("delete")}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ErrorMessage code={error} />
      {cursor && (
        <button type="button" className="secondary" disabled={loading} onClick={loadMore}>
          {loading ? t("loading") : t("loadMore")}
        </button>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        title={t("deleteTitle")}
        message={t("deleteBody")}
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </section>
  );
}
