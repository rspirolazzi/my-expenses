import { apiRequest } from "./client";
import type { AccountIcon, AccountResponse, AccountSummary, InvitationPreview } from "./types";

const account = (id: string) => `/accounts/${encodeURIComponent(id)}`;
const participant = (id: string, participantId: string) =>
  `${account(id)}/participants/${encodeURIComponent(participantId)}`;
const invitation = (code: string) => `/invitations/${encodeURIComponent(code)}`;

const auth = { authenticated: true } as const;

export interface CreateAccountInput {
  name: string;
  description: string | null;
  icon: AccountIcon;
  currency: string;
  myParticipantName: string;
  otherParticipants: string[];
}

export const accountsApi = {
  list: () => apiRequest<AccountSummary[]>("/accounts", auth),
  get: (id: string) => apiRequest<AccountResponse>(account(id), auth),
  create: (input: CreateAccountInput) =>
    apiRequest<AccountResponse>("/accounts", { ...auth, method: "POST", body: input }),
  update: (id: string, patch: { name?: string; description?: string | null; icon?: AccountIcon }) =>
    apiRequest<AccountResponse>(account(id), { ...auth, method: "PATCH", body: patch }),
  addParticipant: (id: string, name: string) =>
    apiRequest<AccountResponse>(`${account(id)}/participants`, {
      ...auth,
      method: "POST",
      body: { name },
    }),
  renameParticipant: (id: string, participantId: string, name: string) =>
    apiRequest<AccountResponse>(participant(id, participantId), {
      ...auth,
      method: "PATCH",
      body: { name },
    }),
  removeParticipant: (id: string, participantId: string) =>
    apiRequest<AccountResponse>(participant(id, participantId), { ...auth, method: "DELETE" }),
  leave: (id: string) => apiRequest<void>(`${account(id)}/leave`, { ...auth, method: "POST" }),
  regenerateInviteCode: (id: string) =>
    apiRequest<AccountResponse>(`${account(id)}/invite-code`, { ...auth, method: "POST" }),
  close: (id: string) =>
    apiRequest<AccountResponse>(`${account(id)}/close`, { ...auth, method: "POST" }),
  remove: (id: string) => apiRequest<void>(account(id), { ...auth, method: "DELETE" }),
  previewInvitation: (code: string) => apiRequest<InvitationPreview>(invitation(code), auth),
  acceptInvitation: (
    code: string,
    choice: { participantId: string } | { newParticipantName: string },
  ) =>
    apiRequest<AccountResponse>(`${invitation(code)}/accept`, {
      ...auth,
      method: "POST",
      body: choice,
    }),
};
