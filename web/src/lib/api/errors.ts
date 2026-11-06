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
  | "network_error"
  | "internal_error";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    public readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

/** Result returned by Server Actions to client components (never contains tokens). */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; code: ApiErrorCode; retryAfterSeconds?: number };

export function failure(error: unknown): {
  ok: false;
  code: ApiErrorCode;
  retryAfterSeconds?: number;
} {
  if (error instanceof ApiError) {
    return { ok: false, code: error.code, retryAfterSeconds: error.retryAfterSeconds };
  }
  return { ok: false, code: "internal_error" };
}
