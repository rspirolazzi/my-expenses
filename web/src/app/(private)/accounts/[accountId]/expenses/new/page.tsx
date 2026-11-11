import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { getAccount } from "@/lib/accountsServer";
import { ApiError } from "@/lib/api/errors";

interface NewExpensePageProps {
  params: Promise<{ accountId: string }>;
}

export default async function NewExpensePage({ params }: NewExpensePageProps) {
  const { accountId } = await params;
  const t = await getTranslations("expenses");
  const account = await getAccount(accountId).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!account) notFound();
  if (account.isClosed) redirect(`/accounts/${account.id}`);
  return (
    <section className="card stack">
      <h1>{t("form.newTitle")}</h1>
      <ExpenseForm account={account} />
    </section>
  );
}
