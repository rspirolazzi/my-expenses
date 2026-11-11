"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { loadMoreExpensesAction } from "@/app/actions/expenses";
import { ErrorMessage } from "@/components/FormMessage";
import type { ApiErrorCode } from "@/lib/api/errors";
import type { AccountResponse, ExpenseListItem as Item, ExpensePage } from "@/lib/api/types";
import { formatDay, groupByDay, mergePages } from "@/lib/expenseGroups";
import { formatMoney } from "@/lib/money";

import { CategoryIcon } from "./CategoryIcon";

interface ExpenseListProps {
  account: AccountResponse;
  firstPage: ExpensePage;
}

export function ExpenseListItem({ account, item }: { account: AccountResponse; item: Item }) {
  const t = useTranslations("expenses");
  const locale = useLocale();
  return (
    <li>
      <Link href={`/accounts/${account.id}/expenses/${item.id}`} className="expense-row">
        <CategoryIcon icon={item.categoryIcon} />
        <span className="expense-main">
          <span>{item.title}</span>
          <small>
            {item.paidBy ? t("paidBy", { name: item.paidBy.name }) : t("noPayer")}
            {item.isPending && <span className="badge">{t("pending")}</span>}
          </small>
        </span>
        <strong>
          {formatMoney(item.amount, account.currency, account.currencyDecimals, locale)}
        </strong>
      </Link>
    </li>
  );
}

/**
 * Total on top, expenses grouped by day, loaded 50 at a time (FR-034, FR-035). It never refreshes
 * by itself: "Refresh" or coming back to the page brings current data (FR-033).
 */
export function ExpenseList({ account, firstPage }: ExpenseListProps) {
  const t = useTranslations("expenses");
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(firstPage.items);
  const [cursor, setCursor] = useState(firstPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  async function loadMore() {
    if (!cursor || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    const result = await loadMoreExpensesAction(account.id, cursor);
    loadingRef.current = false;
    setLoading(false);
    if (!result.ok) {
      setError(result.code);
      return;
    }
    setItems((current) => mergePages(current, result.data.items));
    setCursor(result.data.nextCursor);
  }

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    });
    observer.observe(node);
    return () => observer.disconnect();
    // loadMore only changes with the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  const total = firstPage.total ?? "0";
  return (
    <section className="stack">
      <div className="row space-between">
        <div>
          <small>{t("total")}</small>
          <p className="expense-total">
            {formatMoney(total, account.currency, account.currencyDecimals, locale)}
          </p>
          <small>{t("count", { count: firstPage.count ?? 0 })}</small>
        </div>
        <button type="button" className="secondary" onClick={() => router.refresh()}>
          {t("refresh")}
        </button>
      </div>
      {items.length === 0 ? (
        <p>
          {t("empty")} {!account.isClosed && t("emptyCta")}
        </p>
      ) : (
        groupByDay(items).map((group) => (
          <section key={group.date} aria-label={formatDay(group.date, locale)}>
            <h2 className="day-heading">{formatDay(group.date, locale)}</h2>
            <ul className="expense-list">
              {group.items.map((item) => (
                <ExpenseListItem key={item.id} account={account} item={item} />
              ))}
            </ul>
          </section>
        ))
      )}
      <ErrorMessage code={error} />
      {cursor && (
        <div ref={sentinel}>
          <button type="button" className="secondary" disabled={loading} onClick={loadMore}>
            {loading ? t("loading") : t("loadMore")}
          </button>
        </div>
      )}
    </section>
  );
}
