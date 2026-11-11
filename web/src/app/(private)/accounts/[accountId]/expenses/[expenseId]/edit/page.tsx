import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { getAccount } from "@/lib/accountsServer";
import { ApiError } from "@/lib/api/errors";
import { getExpense } from "@/lib/expensesServer";

export const dynamic = "force-dynamic";

interface EditExpensePageProps {
  params: Promise<{ accountId: string; expenseId: string }>;
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
  const { accountId, expenseId } = await params;
  const t = await getTranslations("expenses");
  const loaded = await Promise.all([getAccount(accountId), getExpense(accountId, expenseId)]).catch(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    },
  );
  if (!loaded) notFound();
  const [account, expense] = loaded;
  if (account.isClosed) redirect(`/accounts/${account.id}/expenses/${expense.id}`);
  return (
    <section className="card stack">
      <h1>{t("form.editTitle")}</h1>
      <ExpenseForm key={expense.version} account={account} expense={expense} />
    </section>
  );
}
