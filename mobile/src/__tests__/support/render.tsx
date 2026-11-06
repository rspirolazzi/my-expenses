import { render } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { PaperProvider } from "react-native-paper";

import i18n from "@/i18n";
import type { AuthResponse, UserResponse } from "@/services/api/types";

export function renderScreen(ui: ReactElement) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nextProvider i18n={i18n}>
        <PaperProvider>{children}</PaperProvider>
      </I18nextProvider>
    );
  }
  return render(ui, { wrapper: Wrapper });
}

export const user: UserResponse = {
  id: "u1",
  email: "ana@mail.com",
  firstName: null,
  lastName: null,
  authProviders: ["email"],
  hasPasswordSet: true,
  pendingEmail: null,
  preferences: { language: "es", defaultCurrency: "ARS", theme: "system" },
  createdAt: "2026-11-06T00:00:00Z",
  updatedAt: "2026-11-06T00:00:00Z",
};

export const authResponse: AuthResponse = {
  tokens: {
    accessToken: "access",
    accessTokenExpiresAt: "2026-11-06T00:15:00Z",
    refreshToken: "refresh",
    refreshTokenExpiresAt: "2026-12-06T00:00:00Z",
  },
  user,
  isNewUser: false,
};

/** Builds a fetch Response-like object. */
export function jsonResponse(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}
