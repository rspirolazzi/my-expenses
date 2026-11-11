"use client";

import { useLocale, useTranslations } from "next-intl";

import type {
  AccountResponse,
  CategoryIcon,
  HistoryChange,
  HistoryEntry,
  ParticipantRef,
} from "@/lib/api/types";
import { formatDay } from "@/lib/expenseGroups";
import { formatMoney } from "@/lib/money";
import { useHydrated } from "@/lib/useHydrated";

interface ExpenseHistoryProps {
  account: AccountResponse;
  entries: HistoryEntry[];
}

/** Who did what and when on an expense, most recent first (FR-030 to FR-032). */
export function ExpenseHistory({ account, entries }: ExpenseHistoryProps) {
  const t = useTranslations("history");
  const tExpenses = useTranslations("expenses");
  const locale = useLocale();
  // Instants are shown in the browser's time zone, which the server does not know: render them
  // after hydration so server and client HTML match.
  const hydrated = useHydrated();
  const when = (at: string) =>
    hydrated
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(at),
        )
      : "";

  function value(change: HistoryChange, side: "before" | "after"): string {
    const raw = change[side];
    if (raw === null || raw === undefined || raw === "") return t("none");
    switch (change.field) {
      case "amount":
        return formatMoney(raw as string, account.currency, account.currencyDecimals, locale);
      case "date":
        return formatDay(raw as string, locale, { dateStyle: "medium" });
      case "categoryIcon":
        return tExpenses(`categories.${raw as CategoryIcon}`);
      case "paidBy":
        return (raw as ParticipantRef).name;
      case "participants": {
        const names = (raw as ParticipantRef[]).map((p) => p.name);
        return names.length ? names.join(", ") : t("none");
      }
      default:
        return raw as string;
    }
  }

  return (
    <section className="stack">
      <h2>{t("title")}</h2>
      {entries.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ol className="history-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <p>
                <strong>{t(entry.action, { name: entry.actorName ?? t("someone") })}</strong>
                <br />
                <small>{when(entry.at)}</small>
              </p>
              {entry.reason === "participant_removed" && <p className="badge">{t("automatic")}</p>}
              {entry.action !== "created" && entry.changes.length > 0 && (
                <ul>
                  {entry.changes.map((change) => (
                    <li key={change.field}>
                      {t(`fields.${change.field}`)}: {value(change, "before")} →{" "}
                      {value(change, "after")}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
