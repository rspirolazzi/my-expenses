import NextAuth, { CredentialsSignin, type User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { AuthResponse, TokenPair } from "@/lib/api/types";

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;
const REFRESH_MARGIN_MS = 60 * 1000;

/** Carries the backend error code to the sign-in caller (e.g. "invalid_code"). */
class BackendSignInError extends CredentialsSignin {
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

type CredentialMode = "password" | "verify-email" | "login-code" | "password-reset";

const ENDPOINTS: Record<CredentialMode, string> = {
  password: "/auth/login",
  "verify-email": "/auth/register/verify",
  "login-code": "/auth/login-code/verify",
  "password-reset": "/auth/password-reset/confirm",
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function bodyFor(mode: CredentialMode, credentials: Record<string, unknown>) {
  const email = str(credentials.email);
  switch (mode) {
    case "password":
      return { email, password: str(credentials.password) };
    case "password-reset":
      return { email, code: str(credentials.code), newPassword: str(credentials.password) };
    default:
      return { email, code: str(credentials.code) };
  }
}

function toUser(response: AuthResponse): User {
  return { id: response.user.id, email: response.user.email, backend: response };
}

function withTokens(token: JWT, tokens: TokenPair): JWT {
  return {
    ...token,
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: Date.parse(tokens.accessTokenExpiresAt),
    refreshToken: tokens.refreshToken,
    refreshTokenExpiresAt: Date.parse(tokens.refreshTokenExpiresAt),
    error: undefined,
  };
}

async function refreshTokens(token: JWT): Promise<JWT> {
  try {
    const tokens = await apiFetch<TokenPair>("/auth/refresh", {
      method: "POST",
      body: { refreshToken: token.refreshToken },
    });
    return withTokens(token, tokens);
  } catch {
    return { ...token, error: "RefreshTokenError" };
  }
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  session: { strategy: "jwt", maxAge: THIRTY_DAYS_SECONDS, updateAge: 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      id: "credentials",
      credentials: {
        mode: {},
        email: {},
        password: {},
        code: {},
        language: {},
      },
      async authorize(credentials) {
        const mode = str(credentials.mode) as CredentialMode;
        if (!(mode in ENDPOINTS)) throw new BackendSignInError("validation_error");
        try {
          const response = await apiFetch<AuthResponse>(ENDPOINTS[mode], {
            method: "POST",
            body: bodyFor(mode, credentials),
            language: str(credentials.language) || undefined,
          });
          return toUser(response);
        } catch (error) {
          if (error instanceof ApiError) {
            const suffix = error.retryAfterSeconds ? `:${error.retryAfterSeconds}` : "";
            throw new BackendSignInError(`${error.code}${suffix}`);
          }
          throw new BackendSignInError("internal_error");
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      if (!account.id_token) return "/login?error=invalid_google_token";
      try {
        const response = await apiFetch<AuthResponse>("/auth/google", {
          method: "POST",
          body: { idToken: account.id_token },
        });
        user.backend = response;
        return true;
      } catch (error) {
        const code = error instanceof ApiError ? error.code : "internal_error";
        return `/login?error=${encodeURIComponent(code)}`;
      }
    },
    async jwt({ token, user, trigger, session }) {
      if (user?.backend) {
        return { ...withTokens(token, user.backend.tokens), user: user.backend.user };
      }
      if (trigger === "update" && session?.user) {
        return { ...token, user: session.user };
      }
      if (!token.accessToken || token.error) return token;
      if (Date.now() < (token.accessTokenExpiresAt ?? 0) - REFRESH_MARGIN_MS) return token;
      return refreshTokens(token);
    },
    async session({ session, token }) {
      // Only the public profile goes to the browser; backend tokens stay in the encrypted cookie.
      if (token.user) session.user = { ...token.user } as typeof session.user;
      session.error = token.error;
      return session;
    },
  },
  events: {
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      if (token?.refreshToken) {
        await apiFetch("/auth/logout", {
          method: "POST",
          body: { refreshToken: token.refreshToken },
        }).catch(() => undefined);
      }
    },
  },
});
