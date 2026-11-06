import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";

export const messages = { es, en };

export function renderWithIntl(
  ui: ReactElement,
  { locale = "es", ...options }: { locale?: "es" | "en" } & RenderOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}

export const userResponse = {
  id: "u1",
  email: "ana@mail.com",
  firstName: null,
  lastName: null,
  authProviders: ["email" as const],
  hasPasswordSet: true,
  pendingEmail: null,
  preferences: { language: "es" as const, defaultCurrency: "ARS", theme: "system" as const },
  createdAt: "2026-11-06T00:00:00Z",
  updatedAt: "2026-11-06T00:00:00Z",
};
