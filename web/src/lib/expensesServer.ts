import "server-only";

import { getLocale } from "next-intl/server";

import { apiFetch } from "./api/client";
import type { ExpensePage, ExpenseResponse, HistoryEntry } from "./api/types";
import { getAccessToken } from "./session";

async function get<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { accessToken: await getAccessToken(), language: await getLocale() });
}

const base = (accountId: string) => `/accounts/${encodeURIComponent(accountId)}/expenses`;

/** First page plus the account total (research R5). */
export const firstExpensePage = (accountId: string) => get<ExpensePage>(base(accountId));

export const getExpense = (accountId: string, expenseId: string) =>
  get<ExpenseResponse>(`${base(accountId)}/${encodeURIComponent(expenseId)}`);

export const getExpenseHistory = (accountId: string, expenseId: string) =>
  get<HistoryEntry[]>(`${base(accountId)}/${encodeURIComponent(expenseId)}/history`);
