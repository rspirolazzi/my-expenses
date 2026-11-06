import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import i18n from "@/i18n";
import { ApiError } from "@/services/api/types";
import { usersApi } from "@/services/api/users";
import { saveTokens } from "@/services/auth/tokenStorage";

import { authResponse, user } from "../support/render";

jest.mock("@/services/api/users", () => ({
  usersApi: { getMe: jest.fn(), updateMe: jest.fn() },
}));

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

async function setup() {
  await saveTokens(authResponse.tokens);
  (usersApi.getMe as jest.Mock).mockResolvedValue(user);
  const hook = renderHook(() => ({ auth: useAuth(), prefs: usePreferences() }), { wrapper });
  await waitFor(() => expect(hook.result.current.auth.status).toBe("authenticated"));
  return hook;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage("es");
});

it("changes the language at once and then persists it", async () => {
  let resolve: (value: unknown) => void = () => undefined;
  (usersApi.updateMe as jest.Mock).mockReturnValue(new Promise((r) => (resolve = r)));
  const { result } = await setup();

  act(() => {
    void result.current.prefs.setLanguage("en");
  });
  expect(i18n.language).toBe("en");
  expect(result.current.auth.user?.preferences.language).toBe("en");
  expect(usersApi.updateMe).toHaveBeenCalledWith({ preferences: { language: "en" } });

  await act(async () => resolve({ ...user, preferences: { ...user.preferences, language: "en" } }));
  expect(result.current.auth.user?.preferences.language).toBe("en");
});

it("reverts when the API fails", async () => {
  (usersApi.updateMe as jest.Mock).mockRejectedValue(new ApiError(500, "internal_error"));
  const { result } = await setup();
  await act(() => result.current.prefs.setTheme("dark"));
  expect(result.current.auth.user?.preferences.theme).toBe("system");
  expect(result.current.prefs.error).toBe("internal_error");
});
