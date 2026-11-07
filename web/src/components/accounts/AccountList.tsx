"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import type { AccountSummary } from "@/lib/api/types";

import { AccountIcon } from "./AccountIcon";

/** "Mis Cuentas": dates are formatted in the user's language (Principle II). */
export function AccountList({ accounts }: { accounts: AccountSummary[] }) {
  const t = useTranslations("accounts");
  const format = useFormatter();
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
          </Link>
        </li>
      ))}
    </ul>
  );
}
