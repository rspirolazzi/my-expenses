import type {
  AccountResponse,
  ExpenseListItem,
  ExpenseResponse,
  HistoryEntry,
  InvitationPreview,
} from "@/lib/api/types";

export function makeAccount(overrides: Partial<AccountResponse> = {}): AccountResponse {
  return {
    id: "acc1",
    name: "Viaje",
    description: null,
    icon: "group",
    currency: "ARS",
    currencyDecimals: 2,
    isClosed: false,
    closedAt: null,
    isOwner: true,
    myParticipantId: "p-ana",
    participants: [
      { id: "p-ana", name: "Ana", isLinked: true, isMe: true, isOwner: true },
      { id: "p-leandro", name: "Leandro", isLinked: false, isMe: false, isOwner: false },
      { id: "p-javier", name: "Javier", isLinked: true, isMe: false, isOwner: false },
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
    myParticipantId: "p-javier",
    participants: [
      { id: "p-ana", name: "Ana", isLinked: true, isMe: false, isOwner: true },
      { id: "p-leandro", name: "Leandro", isLinked: false, isMe: false, isOwner: false },
      { id: "p-javier", name: "Javier", isLinked: true, isMe: true, isOwner: false },
    ],
    ...overrides,
  });

export function makePreview(overrides: Partial<InvitationPreview> = {}): InvitationPreview {
  return {
    accountName: "Viaje",
    icon: "beach",
    currency: "BRL",
    alreadyMember: false,
    accountId: null,
    availableParticipants: [
      { id: "p-leandro", name: "Leandro" },
      { id: "p-martina", name: "Martina" },
    ],
    ...overrides,
  };
}

export function makeExpense(overrides: Partial<ExpenseResponse> = {}): ExpenseResponse {
  return {
    id: "exp1",
    accountId: "acc1",
    date: "2026-11-11",
    title: "Cena",
    description: null,
    amount: "100.00",
    currency: "ARS",
    categoryIcon: "food",
    paidBy: { id: "p-ana", name: "Ana" },
    participants: [
      { id: "p-ana", name: "Ana" },
      { id: "p-leandro", name: "Leandro" },
      { id: "p-javier", name: "Javier" },
    ],
    shares: [
      { participant: { id: "p-ana", name: "Ana" }, amount: "33.34" },
      { participant: { id: "p-leandro", name: "Leandro" }, amount: "33.33" },
      { participant: { id: "p-javier", name: "Javier" }, amount: "33.33" },
    ],
    isPending: false,
    version: 1,
    createdAt: "2026-11-11T12:00:00Z",
    updatedAt: "2026-11-11T12:00:00Z",
    ...overrides,
  };
}

export function makeListItem(overrides: Partial<ExpenseListItem> = {}): ExpenseListItem {
  return {
    id: "exp1",
    date: "2026-11-11",
    title: "Cena",
    categoryIcon: "food",
    amount: "100.00",
    paidBy: { id: "p-ana", name: "Ana" },
    isPending: false,
    ...overrides,
  };
}

export function makeHistory(): HistoryEntry[] {
  return [
    {
      id: "h3",
      action: "updated",
      actorName: "Ana",
      reason: "participant_removed",
      at: "2026-11-11T15:00:00Z",
      changes: [{ field: "paidBy", before: { id: "p-javier", name: "Javier" }, after: null }],
    },
    {
      id: "h2",
      action: "updated",
      actorName: null,
      reason: null,
      at: "2026-11-11T14:00:00Z",
      changes: [{ field: "amount", before: "90.00", after: "120.00" }],
    },
    {
      id: "h1",
      action: "created",
      actorName: "Ana",
      reason: null,
      at: "2026-11-11T12:00:00Z",
      changes: [{ field: "title", before: null, after: "Cena" }],
    },
  ];
}
