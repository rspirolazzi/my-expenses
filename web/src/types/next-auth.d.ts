import type { AuthResponse, UserResponse } from "@/lib/api/types";

declare module "next-auth" {
  interface User {
    /** Backend response for this sign-in; read once by the jwt callback, never sent to the browser. */
    backend?: AuthResponse;
  }

  interface Session {
    /** Only the public user profile is exposed to the browser: never the backend tokens. */
    user: UserResponse;
    error?: "RefreshTokenError";
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    accessTokenExpiresAt?: number;
    refreshToken?: string;
    refreshTokenExpiresAt?: number;
    user?: UserResponse;
    error?: "RefreshTokenError";
  }
}
