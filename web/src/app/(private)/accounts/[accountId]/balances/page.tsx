import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AccountIcon } from "@/components/accounts/AccountIcon";
import { AccountTabs } from "@/components/accounts/AccountTabs";
import { BalanceList } from "@/components/balances/BalanceList";
import { SettlementList } from "@/components/balances/SettlementList";
import { SuggestionList } from "@/components/balances/SuggestionList";
import { getAccount } from "@/lib/accountsServer";
import { ApiError } from "@/lib/api/errors";
import { getBalances, listSettlements } from "@/lib/balancesServer";

// Always current data when the tab is opened or revisited (FR-025).
export const dynamic = "force-dynamic";

interface BalancesPageProps {
  params: Promise<{ accountId: string }>;
}

async function load(accountId: string) {
  try {
    return await Promise.all([
      getAccount(accountId),
      getBalances(accountId),
      listSettlements(accountId),
    ]);
  } catch (error) {
    // Non-members get the same answer as for a missing account (FR-020).
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** "Saldos" tab: balances, then suggestions, then the settlements list (FR-000). */
export default async function AccountBalancesPage({ params }: BalancesPageProps) {
  const { accountId } = await params;
  const [loaded, t, tAccounts, tExpenses] = await Promise.all([
    load(accountId),
    getTranslations("settlements"),
    getTranslations("accounts"),
    getTranslations("expenses"),
  ]);
  if (!loaded) notFound();
  const [account, balances, firstPage] = loaded;
  return (
    <section className="card stack">
      <header className="row space-between">
        <span className="row">
          <AccountIcon icon={account.icon} size="2rem" />
          <span>
            <h1>{account.name}</h1>
            {account.isClosed && <span className="badge">{tAccounts("closedBadge")}</span>}
          </span>
        </span>
        <span className="row">
          <Link href={`/accounts/${account.id}/settings`} className="button secondary">
            {tExpenses("settings")}
          </Link>
          {!account.isClosed && (
            <Link href={`/accounts/${account.id}/settlements/new`} className="button">
              {t("new")}
            </Link>
          )}
        </span>
      </header>
      <AccountTabs accountId={account.id} active="balances" />
      <BalanceList account={account} balances={balances} />
      <SuggestionList account={account} suggestions={balances.suggestions} />
      <SettlementList
        key={firstPage.items.map((item) => item.id).join()}
        account={account}
        firstPage={firstPage}
      />
    </section>
  );
}
