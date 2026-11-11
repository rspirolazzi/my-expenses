/** Error codes from the API contract (contracts/api.md), plus client-side ones. */
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

/** Result returned by Server Actions to client components (never contains tokens). */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | {
      ok: false;
      code: ApiErrorCode;
      retryAfterSeconds?: number;
      details?: Record<string, unknown>;
    };

export function failure(error: unknown): {
  ok: false;
  code: ApiErrorCode;
  retryAfterSeconds?: number;
  details?: Record<string, unknown>;
} {
  if (error instanceof ApiError) {
    return {
      ok: false,
      code: error.code,
      retryAfterSeconds: error.retryAfterSeconds,
      ...(error.details ? { details: error.details } : {}),
    };
  }
  return { ok: false, code: "internal_error" };
}
