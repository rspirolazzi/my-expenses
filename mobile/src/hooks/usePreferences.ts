import { useCallback, useState } from "react";

import { usersApi } from "../services/api/users";
import { type ApiErrorCode, errorCodeOf, type Preferences } from "../services/api/types";

import { useAuth } from "./useAuth";

/**
 * Applies a preference locally at once (SC-004) and then persists it with PATCH /users/me, which
 * is what other devices read (SC-005). On failure the previous value comes back.
 */
export function usePreferences() {
  const { user, setUser } = useAuth();
  const [error, setError] = useState<ApiErrorCode | null>(null);

  const update = useCallback(
    async (patch: Partial<Preferences>) => {
      if (!user) return;
      const previous = user;
      setError(null);
      setUser({ ...user, preferences: { ...user.preferences, ...patch } });
      try {
        setUser(await usersApi.updateMe({ preferences: patch }));
      } catch (err) {
        setUser(previous);
        setError(errorCodeOf(err));
      }
    },
    [user, setUser],
  );

  return {
    preferences: user?.preferences,
    error,
    setLanguage: (language: Preferences["language"]) => update({ language }),
    setTheme: (theme: Preferences["theme"]) => update({ theme }),
    setCurrency: (defaultCurrency: string) => update({ defaultCurrency }),
  };
}
