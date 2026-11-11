"use server";

import { getLocale } from "next-intl/server";

import { apiFetch } from "@/lib/api/client";
import { type ActionResult, failure } from "@/lib/api/errors";
import type {
  CategoryIcon,
  ExpensePage,
  ExpenseResponse,
  ParticipantImpact,
} from "@/lib/api/types";
import { getAccessToken } from "@/lib/session";

type Method = "GET" | "POST" | "PUT" | "DELETE";

async function call<T>(path: string, method: Method, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method,
    body,
    accessToken: await getAccessToken(),
    language: await getLocale(),
  });
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() } as ActionResult<T>;
  } catch (error) {
    return failure(error);
  }
}

const expenses = (accountId: string) => `/accounts/${encodeURIComponent(accountId)}/expenses`;
const expense = (accountId: string, expenseId: string) =>
  `${expenses(accountId)}/${encodeURIComponent(expenseId)}`;

export interface ExpenseInput {
  date: string;
  title: string;
  description: string | null;
  /** Decimal text with a dot, as the API expects ("100.50"). */
  amount: string;
  paidById: string;
  participantIds: string[];
  categoryIcon: CategoryIcon;
}

export async function createExpenseAction(
  accountId: string,
  input: ExpenseInput,
  clientRequestId: string,
): Promise<ActionResult<ExpenseResponse>> {
  return run(() =>
    call<ExpenseResponse>(expenses(accountId), "POST", { ...input, clientRequestId }),
  );
}

export async function updateExpenseAction(
  accountId: string,
  expenseId: string,
  input: ExpenseInput,
  version: number,
): Promise<ActionResult<ExpenseResponse>> {
  return run(() =>
    call<ExpenseResponse>(expense(accountId, expenseId), "PUT", { ...input, version }),
  );
}

export async function deleteExpenseAction(
  accountId: string,
  expenseId: string,
  version: number,
): Promise<ActionResult<null>> {
  return run(async () => {
    await call<void>(`${expense(accountId, expenseId)}?version=${version}`, "DELETE");
    return null;
  });
}

export async function loadMoreExpensesAction(
  accountId: string,
  cursor: string,
): Promise<ActionResult<ExpensePage>> {
  return run(() =>
    call<ExpensePage>(`${expenses(accountId)}?cursor=${encodeURIComponent(cursor)}`, "GET"),
  );
}

export async function participantImpactAction(
  accountId: string,
  participantId: string,
): Promise<ActionResult<ParticipantImpact>> {
  return run(() =>
    call<ParticipantImpact>(
      `/accounts/${encodeURIComponent(accountId)}/participants/${encodeURIComponent(participantId)}/impact`,
      "GET",
    ),
  );
}
