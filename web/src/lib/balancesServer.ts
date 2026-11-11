import "server-only";

import { getLocale } from "next-intl/server";

import { apiFetch } from "./api/client";
import type { AccountBalances, SettlementPage } from "./api/types";
import { getAccessToken } from "./session";

async function get<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { accessToken: await getAccessToken(), language: await getLocale() });
}

const account = (accountId: string) => `/accounts/${encodeURIComponent(accountId)}`;

/** Balances, suggestions and the pending expenses count in one read (research R5). */
export const getBalances = (accountId: string) =>
  get<AccountBalances>(`${account(accountId)}/balances`);

/** First page of the active settlements, most recent first. */
export const listSettlements = (accountId: string) =>
  get<SettlementPage>(`${account(accountId)}/settlements`);
