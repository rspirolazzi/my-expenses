import "server-only";

import { getLocale } from "next-intl/server";

import { apiFetch } from "./api/client";
import type { AccountResponse, AccountSummary, InvitationPreview } from "./api/types";
import { getAccessToken } from "./session";

async function get<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { accessToken: await getAccessToken(), language: await getLocale() });
}

export const listMyAccounts = () => get<AccountSummary[]>("/accounts");

export const getAccount = (id: string) =>
  get<AccountResponse>(`/accounts/${encodeURIComponent(id)}`);

export const getInvitation = (code: string) =>
  get<InvitationPreview>(`/invitations/${encodeURIComponent(code)}`);
