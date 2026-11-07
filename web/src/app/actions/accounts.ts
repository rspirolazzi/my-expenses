"use server";

import { getLocale } from "next-intl/server";

import { apiFetch } from "@/lib/api/client";
import { type ActionResult, failure } from "@/lib/api/errors";
import type { AccountIcon, AccountResponse, InvitationPreview } from "@/lib/api/types";
import { getAccessToken } from "@/lib/session";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

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

const account = (id: string) => `/accounts/${encodeURIComponent(id)}`;
const participant = (id: string, participantId: string) =>
  `${account(id)}/participants/${encodeURIComponent(participantId)}`;

export interface CreateAccountInput {
  name: string;
  description?: string;
  icon: AccountIcon;
  currency: string;
  myParticipantName: string;
  otherParticipants: string[];
}

export async function createAccountAction(
  input: CreateAccountInput,
): Promise<ActionResult<AccountResponse>> {
  return run(() =>
    call<AccountResponse>("/accounts", "POST", {
      ...input,
      description: input.description?.trim() || null,
    }),
  );
}

export async function updateAccountAction(
  id: string,
  patch: { name?: string; description?: string | null; icon?: AccountIcon },
): Promise<ActionResult<AccountResponse>> {
  return run(() => call<AccountResponse>(account(id), "PATCH", patch));
}

export async function addParticipantAction(
  id: string,
  name: string,
): Promise<ActionResult<AccountResponse>> {
  return run(() => call<AccountResponse>(`${account(id)}/participants`, "POST", { name }));
}

export async function renameParticipantAction(
  id: string,
  participantId: string,
  name: string,
): Promise<ActionResult<AccountResponse>> {
  return run(() => call<AccountResponse>(participant(id, participantId), "PATCH", { name }));
}

export async function removeParticipantAction(
  id: string,
  participantId: string,
): Promise<ActionResult<AccountResponse>> {
  return run(() => call<AccountResponse>(participant(id, participantId), "DELETE"));
}

export async function leaveAccountAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await call<void>(`${account(id)}/leave`, "POST");
    return null;
  });
}

export async function regenerateInviteAction(id: string): Promise<ActionResult<AccountResponse>> {
  return run(() => call<AccountResponse>(`${account(id)}/invite-code`, "POST"));
}

export async function closeAccountAction(id: string): Promise<ActionResult<AccountResponse>> {
  return run(() => call<AccountResponse>(`${account(id)}/close`, "POST"));
}

export async function deleteAccountAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await call<void>(account(id), "DELETE");
    return null;
  });
}

export async function previewInvitationAction(
  code: string,
): Promise<ActionResult<InvitationPreview>> {
  return run(() => call<InvitationPreview>(`/invitations/${encodeURIComponent(code)}`, "GET"));
}

export async function acceptInvitationAction(
  code: string,
  choice: { participantId: string } | { newParticipantName: string },
): Promise<ActionResult<AccountResponse>> {
  return run(() =>
    call<AccountResponse>(`/invitations/${encodeURIComponent(code)}/accept`, "POST", choice),
  );
}
