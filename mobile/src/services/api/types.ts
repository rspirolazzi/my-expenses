import type { components } from "./schema";

type Schemas = components["schemas"];

export type UserResponse = Schemas["UserResponse"];
export type Preferences = Schemas["Preferences"];
export type TokenPair = Schemas["TokenPair"];
export type AuthResponse = Schemas["AuthResponse"];
export type UpdateMeRequest = Schemas["UpdateMeRequest"];
export type ThemeName = Preferences["theme"];
export type LanguageCode = Preferences["language"];

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

export function errorCodeOf(error: unknown): ApiErrorCode {
  return error instanceof ApiError ? error.code : "internal_error";
}
