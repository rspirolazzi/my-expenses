import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import i18n from "../i18n";
import { authApi } from "../services/api/auth";
import { onSessionExpired, setRequestLanguage } from "../services/api/client";
import type { AuthResponse, UserResponse } from "../services/api/types";
import { usersApi } from "../services/api/users";
import { signOutFromGoogle } from "../services/auth/googleSignIn";
import { clearTokens, getTokens, saveTokens } from "../services/auth/tokenStorage";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: UserResponse | null;
  /** True when the session ended on its own (expired), not through Logout. */
  sessionExpired: boolean;
  signInWithTokens: (auth: AuthResponse) => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: UserResponse) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applyLanguage(user: UserResponse | null) {
  const language = user?.preferences.language;
  if (language && i18n.language !== language) void i18n.changeLanguage(language);
  setRequestLanguage(language ?? i18n.language);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUserState] = useState<UserResponse | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const setUser = useCallback((next: UserResponse) => {
    setUserState(next);
    applyLanguage(next);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const tokens = await getTokens();
      if (!tokens) {
        if (active) setStatus("unauthenticated");
        return;
      }
      try {
        const me = await usersApi.getMe();
        if (!active) return;
        setUser(me);
        setStatus("authenticated");
      } catch {
        if (active) setStatus("unauthenticated");
      }
    })();
    const unsubscribe = onSessionExpired(() => {
      setSessionExpired(true);
      setStatus("unauthenticated");
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [setUser]);

  const signInWithTokens = useCallback(
    async (auth: AuthResponse) => {
      await saveTokens(auth.tokens);
      setUser(auth.user);
      setSessionExpired(false);
      setStatus("authenticated");
    },
    [setUser],
  );

  const refreshUser = useCallback(async () => {
    setUser(await usersApi.getMe());
  }, [setUser]);

  const logout = useCallback(async () => {
    const tokens = await getTokens();
    // The local session ends even if the API cannot be reached.
    if (tokens) await authApi.logout(tokens.refreshToken).catch(() => undefined);
    await clearTokens();
    await signOutFromGoogle();
    setUserState(null);
    setSessionExpired(false);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo(
    () => ({ status, user, sessionExpired, signInWithTokens, refreshUser, setUser, logout }),
    [status, user, sessionExpired, signInWithTokens, refreshUser, setUser, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
