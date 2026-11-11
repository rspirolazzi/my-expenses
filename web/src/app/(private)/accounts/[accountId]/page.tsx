import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AccountIcon } from "@/components/accounts/AccountIcon";
import { AccountTabs } from "@/components/accounts/AccountTabs";
import { ExpenseList } from "@/components/expenses/ExpenseList";
import { getAccount } from "@/lib/accountsServer";
import { ApiError } from "@/lib/api/errors";
import { firstExpensePage } from "@/lib/expensesServer";

// Always current data when the page is opened or revisited (FR-033).
export const dynamic = "force-dynamic";

interface AccountPageProps {
  params: Promise<{ accountId: string }>;
}

async function load(accountId: string) {
  try {
    return await Promise.all([getAccount(accountId), firstExpensePage(accountId)]);
  } catch (error) {
    // Non-members get the same answer as for a missing account (FR-019).
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function AccountExpensesPage({ params }: AccountPageProps) {
  const { accountId } = await params;
  const [loaded, t, tAccounts] = await Promise.all([
    load(accountId),
    getTranslations("expenses"),
    getTranslations("accounts"),
  ]);
  if (!loaded) notFound();
  const [account, firstPage] = loaded;
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
            {t("settings")}
          </Link>
          {!account.isClosed && (
            <Link href={`/accounts/${account.id}/expenses/new`} className="button">
              {t("new")}
            </Link>
          )}
        </span>
      </header>
      <AccountTabs accountId={account.id} active="expenses" />
      <ExpenseList
        key={firstPage.items.map((i) => i.id).join()}
        account={account}
        firstPage={firstPage}
      />
    </section>
  );
}
