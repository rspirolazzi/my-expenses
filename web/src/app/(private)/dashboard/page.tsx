import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { AccountList } from "@/components/accounts/AccountList";
import { BalanceSummary } from "@/components/balances/BalanceSummary";
import { listMyAccounts } from "@/lib/accountsServer";
import { displayName } from "@/lib/displayName";

export default async function DashboardPage() {
  const [session, t, accounts] = await Promise.all([auth(), getTranslations(), listMyAccounts()]);
  const name = session?.user ? displayName(session.user) : "";
  return (
    <section className="card stack">
      <h1>{t("dashboard.title", { name })}</h1>
      {accounts.length > 0 && <BalanceSummary accounts={accounts} />}
      <header className="row space-between">
        <h2>{t("accounts.recent")}</h2>
        <span className="row">
          <Link href="/accounts/new" className="button">
            {t("accounts.new")}
          </Link>
          <Link href="/accounts">{t("accounts.seeAll")}</Link>
        </span>
      </header>
      <AccountList accounts={accounts.slice(0, 5)} />
    </section>
  );
}
