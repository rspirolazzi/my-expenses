"use server";

import { getLocale } from "next-intl/server";

import { apiFetch } from "@/lib/api/client";
import { type ActionResult, failure } from "@/lib/api/errors";
import type { SettlementPage, SettlementResponse } from "@/lib/api/types";
import { getAccessToken } from "@/lib/session";

type Method = "GET" | "POST" | "DELETE";

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

const settlements = (accountId: string) => `/accounts/${encodeURIComponent(accountId)}/settlements`;

export interface SettlementInput {
  fromParticipantId: string;
  toParticipantId: string;
  /** Decimal text with a dot, as the API expects ("30.00"). */
  amount: string;
  date: string;
  source: "suggestion" | "manual";
}

export async function createSettlementAction(
  accountId: string,
  input: SettlementInput,
  clientRequestId: string,
): Promise<ActionResult<SettlementResponse>> {
  return run(() =>
    call<SettlementResponse>(settlements(accountId), "POST", { ...input, clientRequestId }),
  );
}

export async function deleteSettlementAction(
  accountId: string,
  settlementId: string,
): Promise<ActionResult<null>> {
  return run(async () => {
    await call<void>(`${settlements(accountId)}/${encodeURIComponent(settlementId)}`, "DELETE");
    return null;
  });
}

export async function loadMoreSettlementsAction(
  accountId: string,
  cursor: string,
): Promise<ActionResult<SettlementPage>> {
  return run(() =>
    call<SettlementPage>(`${settlements(accountId)}?cursor=${encodeURIComponent(cursor)}`, "GET"),
  );
}
