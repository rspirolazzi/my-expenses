import { apiRequest } from "./client";
import type { AuthResponse } from "./types";

const post = <T>(path: string, body: unknown) => apiRequest<T>(path, { method: "POST", body });

export const authApi = {
  register: (input: {
    email: string;
    password: string;
    firstName?: string | null;
    lastName?: string | null;
    language: string;
  }) => post<void>("/auth/register", input),
  resendRegistration: (email: string) => post<void>("/auth/register/resend", { email }),
  verifyRegistration: (email: string, code: string) =>
    post<AuthResponse>("/auth/register/verify", { email, code }),
  loginWithPassword: (email: string, password: string) =>
    post<AuthResponse>("/auth/login", { email, password }),
  requestLoginCode: (email: string) => post<void>("/auth/login-code", { email }),
  verifyLoginCode: (email: string, code: string) =>
    post<AuthResponse>("/auth/login-code/verify", { email, code }),
  loginWithGoogle: (idToken: string) => post<AuthResponse>("/auth/google", { idToken }),
  requestPasswordReset: (email: string) => post<void>("/auth/password-reset", { email }),
  confirmPasswordReset: (email: string, code: string, newPassword: string) =>
    post<AuthResponse>("/auth/password-reset/confirm", { email, code, newPassword }),
  logout: (refreshToken: string) => post<void>("/auth/logout", { refreshToken }),
};
