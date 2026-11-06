import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";

import { auth } from "@/auth";
import { AppProviders } from "@/components/AppProviders";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

import "./globals.css";

export const metadata: Metadata = {
  title: "Mis Gastos",
  description: "Split group expenses simply and transparently.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const user = session?.user && !session.error ? session.user : null;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider>
          <AppProviders theme={user?.preferences.theme}>
            <SiteHeader user={user} />
            <main className="page">{children}</main>
            <SiteFooter />
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
