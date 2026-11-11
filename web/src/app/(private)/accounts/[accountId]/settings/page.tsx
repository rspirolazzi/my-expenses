import { notFound } from "next/navigation";

import { AccountDetail } from "@/components/accounts/AccountDetail";
import { getAccount } from "@/lib/accountsServer";
import { ApiError } from "@/lib/api/errors";
import type { AccountResponse } from "@/lib/api/types";

interface AccountPageProps {
  params: Promise<{ accountId: string }>;
}

async function load(accountId: string): Promise<AccountResponse | null> {
  try {
    return await getAccount(accountId);
  } catch (error) {
    // Non-members get the same answer as for a missing account (FR-007).
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function AccountPage({ params }: AccountPageProps) {
  const { accountId } = await params;
  const account = await load(accountId);
  if (!account) notFound();
  return <AccountDetail key={account.updatedAt} initialAccount={account} />;
}
