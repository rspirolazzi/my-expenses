"use client";

import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import type { AccountSummary } from "@/lib/api/types";
import { absAmount, amountSign } from "@/lib/balanceTotals";
import { formatMoney } from "@/lib/money";

import { AccountIcon } from "./AccountIcon";

/** "Mis Cuentas": dates are formatted in the user's language (Principle II). */
export function AccountList({ accounts }: { accounts: AccountSummary[] }) {
  const t = useTranslations("accounts");
  const tBalances = useTranslations("balances");
  const format = useFormatter();
  const locale = useLocale();

  function balance(account: AccountSummary) {
    const sign = amountSign(account.myBalance);
    const amount = formatMoney(
      absAmount(account.myBalance),
      account.currency,
      account.currencyDecimals,
      locale,
    );
    if (sign > 0)
      return <span className="amount-positive">{tBalances("owedToYou", { amount })}</span>;
    if (sign < 0) return <span className="amount-negative">{tBalances("youOwe", { amount })}</span>;
    return <span>{tBalances("youSettled")}</span>;
  }

  if (accounts.length === 0) return <p>{t("empty")}</p>;
  return (
    <ul className="account-list">
      {accounts.map((account) => (
        <li key={account.id}>
          <Link href={`/accounts/${account.id}`} className="row">
            <AccountIcon icon={account.icon} />
            <span>
              <strong>{account.name}</strong>
              <small>
                {" "}
                · {account.currency} · {t("participantCount", { count: account.participantCount })}{" "}
                ·{" "}
                {t("updatedAt", {
                  date: format.dateTime(new Date(account.updatedAt), { dateStyle: "medium" }),
                })}
              </small>
            </span>
            {account.isClosed && <span className="badge">{t("closedBadge")}</span>}
            <strong className="account-balance">{balance(account)}</strong>
          </Link>
        </li>
      ))}
    </ul>
  );
}
