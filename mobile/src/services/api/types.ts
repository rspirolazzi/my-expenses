import type { components } from "./schema";

type Schemas = components["schemas"];

export type UserResponse = Schemas["UserResponse"];
export type Preferences = Schemas["Preferences"];
export type TokenPair = Schemas["TokenPair"];
export type AuthResponse = Schemas["AuthResponse"];
export type UpdateMeRequest = Schemas["UpdateMeRequest"];
export type ThemeName = Preferences["theme"];
export type LanguageCode = Preferences["language"];
export type AccountResponse = Schemas["AccountResponse"];
export type AccountSummary = Schemas["AccountSummary"];
export type ParticipantResponse = Schemas["ParticipantResponse"];
export type InvitationPreview = Schemas["InvitationPreview"];
export type AccountIcon = AccountResponse["icon"];
export type ExpenseResponse = Schemas["ExpenseResponse"];
export type ExpenseListItem = Schemas["ExpenseListItem"];
export type ExpensePage = Schemas["ExpensePage"];
export type ParticipantRef = Schemas["ParticipantRef"];
export type HistoryEntry = Schemas["HistoryEntry"];
export type HistoryChange = Schemas["HistoryChange"];
export type ParticipantImpact = Schemas["ParticipantImpact"];
export type CategoryIcon = ExpenseResponse["categoryIcon"];
export type AccountBalances = Schemas["AccountBalances"];
export type BalanceEntry = Schemas["BalanceEntry"];
export type SuggestedTransfer = Schemas["SuggestedTransfer"];
export type SettlementResponse = Schemas["SettlementResponse"];
export type SettlementPage = Schemas["SettlementPage"];
export type SettlementCreate = Schemas["SettlementCreate"];

export type ApiErrorCode =
  | "validation_error"
  | "rate_limited"
  | "email_unavailable"
  | "invalid_code"
  | "invalid_credentials"
  | "password_login_locked"
  | "invalid_google_token"
  | "google_email_not_verified"
  | "invalid_refresh_token"
  | "unauthorized"
  | "email_taken"
  | "not_found"
  | "account_closed"
  | "owner_only"
  | "owner_cannot_leave"
  | "owner_participant"
  | "duplicate_participant_name"
  | "invalid_invitation"
  | "already_member"
  | "participant_taken"
  | "expense_conflict"
  | "invalid_participant"
  | "network_error"
  | "internal_error";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    public readonly retryAfterSeconds?: number,
    /** Extra top-level fields of the error body, e.g. `current` for expense_conflict. */
    public readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export function errorCodeOf(error: unknown): ApiErrorCode {
  return error instanceof ApiError ? error.code : "internal_error";
}
