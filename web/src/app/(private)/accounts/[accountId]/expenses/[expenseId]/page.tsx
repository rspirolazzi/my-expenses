import { notFound } from "next/navigation";

import { ExpenseDetail } from "@/components/expenses/ExpenseDetail";
import { ExpenseHistory } from "@/components/expenses/ExpenseHistory";
import { getAccount } from "@/lib/accountsServer";
import { ApiError } from "@/lib/api/errors";
import { getExpense, getExpenseHistory } from "@/lib/expensesServer";

export const dynamic = "force-dynamic";

interface ExpensePageProps {
  params: Promise<{ accountId: string; expenseId: string }>;
}

async function load(accountId: string, expenseId: string) {
  try {
    return await Promise.all([
      getAccount(accountId),
      getExpense(accountId, expenseId),
      getExpenseHistory(accountId, expenseId),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function ExpensePage({ params }: ExpensePageProps) {
  const { accountId, expenseId } = await params;
  const loaded = await load(accountId, expenseId);
  if (!loaded) notFound();
  const [account, expense, history] = loaded;
  return (
    <div className="stack">
      <ExpenseDetail key={expense.version} account={account} expense={expense} />
      <section className="card">
        <ExpenseHistory account={account} entries={history} />
      </section>
    </div>
  );
}
