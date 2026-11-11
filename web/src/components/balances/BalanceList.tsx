"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import type { AccountBalances, AccountResponse, BalanceEntry } from "@/lib/api/types";
import { absAmount, amountSign } from "@/lib/balanceTotals";
import { formatMoney } from "@/lib/money";

interface BalanceListProps {
  account: AccountResponse;
  balances: AccountBalances;
}

function useBalanceText() {
  const t = useTranslations("balances");
  const locale = useLocale();
  return (entry: BalanceEntry, balances: AccountBalances) => {
    const amount = formatMoney(
      absAmount(entry.amount),
      balances.currency,
      balances.currencyDecimals,
      locale,
    );
    const sign = amountSign(entry.amount);
    if (entry.isMe) {
      if (sign > 0) return t("owedToYou", { amount });
      if (sign < 0) return t("youOwe", { amount });
      return t("youSettled");
    }
    if (sign > 0) return t("owed", { amount });
    if (sign < 0) return t("owes", { amount });
    return t("settled");
  };
}

/**
 * The balance of each active participant, mine highlighted in plain words (FR-007), plus the
 * pending expenses notice (FR-006). It never refreshes by itself (FR-025).
 */
export function BalanceList({ account, balances }: BalanceListProps) {
  const t = useTranslations("balances");
  const router = useRouter();
  const text = useBalanceText();
  const noDebts = balances.balances.every((entry) => amountSign(entry.amount) === 0);
  return (
    <section className="stack" aria-labelledby="balances-title">
      <div className="row space-between">
        <h2 id="balances-title">{t("title")}</h2>
        <button type="button" className="secondary" onClick={() => router.refresh()}>
          {t("refresh")}
        </button>
      </div>
      {balances.pendingExpenses > 0 && (
        <p role="status" className="form-status">
          <strong>{t("pending", { count: balances.pendingExpenses })}</strong>. {t("pendingHint")}{" "}
          <Link href={`/accounts/${account.id}`}>{t("pendingLink")}</Link>
        </p>
      )}
      <ul className="balance-list">
        {balances.balances.map((entry) => {
          const sign = amountSign(entry.amount);
          return (
            <li
              key={entry.participant.id}
              className={entry.isMe ? "balance-row me" : "balance-row"}
            >
              <span>
                {entry.participant.name}
                {entry.isMe && <small> ({t("you")})</small>}
              </span>
              <strong
                className={sign > 0 ? "amount-positive" : sign < 0 ? "amount-negative" : undefined}
              >
                {text(entry, balances)}
              </strong>
            </li>
          );
        })}
      </ul>
      {noDebts && <p>{t("noDebts")}</p>}
    </section>
  );
}
