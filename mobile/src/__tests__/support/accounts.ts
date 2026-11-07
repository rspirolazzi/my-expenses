import type { AccountResponse, InvitationPreview } from "@/services/api/types";

export function makeAccount(overrides: Partial<AccountResponse> = {}): AccountResponse {
  return {
    id: "acc1",
    name: "Viaje",
    description: null,
    icon: "group",
    currency: "ARS",
    isClosed: false,
    closedAt: null,
    isOwner: true,
    myParticipantId: "p-ana",
    participants: [
      { id: "p-ana", name: "Ana", isLinked: true, isMe: true, isOwner: true },
      { id: "p-leandro", name: "Leandro", isLinked: false, isMe: false, isOwner: false },
    ],
    inviteCode: "abcdefghijklmnopqrstuv",
    createdAt: "2026-11-06T00:00:00Z",
    updatedAt: "2026-11-06T00:00:00Z",
    ...overrides,
  };
}

export const memberView = (overrides: Partial<AccountResponse> = {}) =>
  makeAccount({
    isOwner: false,
    myParticipantId: "p-leandro",
    participants: [
      { id: "p-ana", name: "Ana", isLinked: true, isMe: false, isOwner: true },
      { id: "p-leandro", name: "Leandro", isLinked: true, isMe: true, isOwner: false },
    ],
    ...overrides,
  });

export const preview = (overrides: Partial<InvitationPreview> = {}): InvitationPreview => ({
  accountName: "Viaje",
  icon: "beach",
  currency: "BRL",
  alreadyMember: false,
  accountId: null,
  availableParticipants: [{ id: "p-leandro", name: "Leandro" }],
  ...overrides,
});
