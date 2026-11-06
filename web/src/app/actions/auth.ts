"use server";

import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";

import { signIn, signOut } from "@/auth";
import { apiFetch } from "@/lib/api/client";
import { type ActionResult, type ApiErrorCode, failure } from "@/lib/api/errors";
import { safeCallbackUrl } from "@/lib/safeCallbackUrl";

interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

async function accepted(path: string, body: unknown): Promise<ActionResult> {
  try {
    await apiFetch(path, { method: "POST", body, language: await getLocale() });
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function registerAction(input: RegisterInput): Promise<ActionResult> {
  return accepted("/auth/register", {
    email: input.email,
    password: input.password,
    firstName: input.firstName || null,
    lastName: input.lastName || null,
    language: await getLocale(),
  });
}

export async function resendRegistrationAction(email: string): Promise<ActionResult> {
  return accepted("/auth/register/resend", { email });
}

export async function requestLoginCodeAction(email: string): Promise<ActionResult> {
  return accepted("/auth/login-code", { email });
}

export async function requestPasswordResetAction(email: string): Promise<ActionResult> {
  return accepted("/auth/password-reset", { email });
}

export type CredentialMode = "password" | "verify-email" | "login-code" | "password-reset";

interface CredentialsInput {
  mode: CredentialMode;
  email: string;
  password?: string;
  code?: string;
}

/** Sign in through the Auth.js Credentials provider, which calls the backend. */
export async function credentialsSignInAction(input: CredentialsInput): Promise<ActionResult> {
  try {
    await signIn("credentials", { ...input, language: await getLocale(), redirect: false });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      const raw = (error as AuthError & { code?: string }).code ?? "internal_error";
      const [code, retry] = raw.split(":");
      return {
        ok: false,
        code: code as ApiErrorCode,
        retryAfterSeconds: retry ? Number(retry) : undefined,
      };
    }
    throw error;
  }
}

export async function googleSignInAction(callbackUrl?: string): Promise<void> {
  await signIn("google", { redirectTo: safeCallbackUrl(callbackUrl) });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
