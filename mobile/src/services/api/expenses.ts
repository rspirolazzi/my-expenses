import { apiRequest } from "./client";
import type {
  CategoryIcon,
  ExpensePage,
  ExpenseResponse,
  HistoryEntry,
  ParticipantImpact,
} from "./types";

const auth = { authenticated: true } as const;
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

export const expensesApi = {
  list: (accountId: string, cursor?: string | null) =>
    apiRequest<ExpensePage>(
      cursor ? `${expenses(accountId)}?cursor=${encodeURIComponent(cursor)}` : expenses(accountId),
      auth,
    ),
  get: (accountId: string, expenseId: string) =>
    apiRequest<ExpenseResponse>(expense(accountId, expenseId), auth),
  create: (accountId: string, input: ExpenseInput, clientRequestId: string) =>
    apiRequest<ExpenseResponse>(expenses(accountId), {
      ...auth,
      method: "POST",
      body: { ...input, clientRequestId },
    }),
  update: (accountId: string, expenseId: string, input: ExpenseInput, version: number) =>
    apiRequest<ExpenseResponse>(expense(accountId, expenseId), {
      ...auth,
      method: "PUT",
      body: { ...input, version },
    }),
  remove: (accountId: string, expenseId: string, version: number) =>
    apiRequest<void>(`${expense(accountId, expenseId)}?version=${version}`, {
      ...auth,
      method: "DELETE",
    }),
  history: (accountId: string, expenseId: string) =>
    apiRequest<HistoryEntry[]>(`${expense(accountId, expenseId)}/history`, auth),
  participantImpact: (accountId: string, participantId: string) =>
    apiRequest<ParticipantImpact>(
      `/accounts/${encodeURIComponent(accountId)}/participants/${encodeURIComponent(participantId)}/impact`,
      auth,
    ),
};
