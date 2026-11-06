export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 60;

export type ValidationKey =
  | "emailInvalid"
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordEqualsEmail"
  | "nameTooLong"
  | "codeInvalid";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): ValidationKey | null {
  return EMAIL_PATTERN.test(email.trim()) ? null : "emailInvalid";
}

/** FR-007: at least 8 characters and not equal to the email. */
export function validatePassword(password: string, email: string): ValidationKey | null {
  if (password.length < PASSWORD_MIN) return "passwordTooShort";
  if (password.length > PASSWORD_MAX) return "passwordTooLong";
  if (password.trim().toLowerCase() === email.trim().toLowerCase()) return "passwordEqualsEmail";
  return null;
}

export function validateName(name: string): ValidationKey | null {
  return name.trim().length > NAME_MAX ? "nameTooLong" : null;
}

export function validateCode(code: string): ValidationKey | null {
  return /^\d{6}$/.test(code) ? null : "codeInvalid";
}
