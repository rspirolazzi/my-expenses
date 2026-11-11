import { apiRequest } from "./client";
import type { AccountBalances, SettlementPage, SettlementResponse } from "./types";

const auth = { authenticated: true } as const;
const account = (accountId: string) => `/accounts/${encodeURIComponent(accountId)}`;
const settlements = (accountId: string) => `${account(accountId)}/settlements`;

export interface SettlementInput {
  fromParticipantId: string;
  toParticipantId: string;
  /** Decimal text with a dot, as the API expects ("30.00"). */
  amount: string;
  date: string;
  source: "suggestion" | "manual";
}

export const settlementsApi = {
  /** Balances, suggestions and the pending expenses count in one read. */
  balances: (accountId: string) =>
    apiRequest<AccountBalances>(`${account(accountId)}/balances`, auth),
  list: (accountId: string, cursor?: string | null) =>
    apiRequest<SettlementPage>(
      cursor
        ? `${settlements(accountId)}?cursor=${encodeURIComponent(cursor)}`
        : settlements(accountId),
      auth,
    ),
  create: (accountId: string, input: SettlementInput, clientRequestId: string) =>
    apiRequest<SettlementResponse>(settlements(accountId), {
      ...auth,
      method: "POST",
      body: { ...input, clientRequestId },
    }),
  remove: (accountId: string, settlementId: string) =>
    apiRequest<void>(`${settlements(accountId)}/${encodeURIComponent(settlementId)}`, {
      ...auth,
      method: "DELETE",
    }),
};
