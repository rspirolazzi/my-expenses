import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SettlementForm } from "@/components/balances/SettlementForm";
import { getAccount } from "@/lib/accountsServer";
import { ApiError } from "@/lib/api/errors";

interface NewSettlementPageProps {
  params: Promise<{ accountId: string }>;
}

export default async function NewSettlementPage({ params }: NewSettlementPageProps) {
  const { accountId } = await params;
  const t = await getTranslations("settlements");
  const account = await getAccount(accountId).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!account) notFound();
  // A closed account is read only (FR-019).
  if (account.isClosed) redirect(`/accounts/${account.id}/balances`);
  return (
    <section className="card stack">
      <h1>{t("newTitle")}</h1>
      <SettlementForm account={account} />
      <Link href={`/accounts/${account.id}/balances`}>{t("back")}</Link>
    </section>
  );
}
