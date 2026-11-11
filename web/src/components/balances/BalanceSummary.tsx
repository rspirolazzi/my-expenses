"use client";

import { useLocale, useTranslations } from "next-intl";

import type { AccountSummary } from "@/lib/api/types";
import { totalsByCurrency } from "@/lib/balanceTotals";
import { formatMoney } from "@/lib/money";

/**
 * "Te deben" and "Debés" per currency over every account, closed ones included (FR-024). Amounts
 * of different currencies are never added together.
 */
export function BalanceSummary({ accounts }: { accounts: AccountSummary[] }) {
  const t = useTranslations("dashboard.balances");
  const locale = useLocale();
  const totals = totalsByCurrency(accounts);
  if (totals.length === 0) return <p>{t("allSettled")}</p>;
  const column = (label: string, pick: "owedToMe" | "iOwe", className: string) => (
    <div role="group" aria-label={label} className="stack">
      <small>{label}</small>
      {totals
        .filter((total) => /[1-9]/.test(total[pick]))
        .map((total) => (
          <strong key={total.currency} className={className}>
            {formatMoney(total[pick], total.currency, total.decimals, locale)}
          </strong>
        ))}
    </div>
  );
  return (
    <section className="stack" aria-labelledby="balance-summary-title">
      <h2 id="balance-summary-title">{t("title")}</h2>
      <div className="row space-between">
        {column(t("owedToYou"), "owedToMe", "amount-positive")}
        {column(t("youOwe"), "iOwe", "amount-negative")}
      </div>
    </section>
  );
}
