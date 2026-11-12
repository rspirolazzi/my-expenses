import Link from "next/link";
import { useTranslations } from "next-intl";

import type { UserResponse } from "@/lib/api/types";
import { displayName } from "@/lib/displayName";

import { LogoutButton } from "./LogoutButton";

/** Header from the constitution's "Estructura de Navegación y UI Base". */
export function SiteHeader({ user }: { user: UserResponse | null }) {
  const t = useTranslations("nav");

  return (
    <header className="site-header">
      <Link href="/" className="brand">
        ChePagame
      </Link>
      <nav aria-label="main">
        <Link href="/">{t("home")}</Link>
        <Link href="/how-it-works">{t("howItWorks")}</Link>
        <Link href="/about">{t("about")}</Link>
        <Link href="/contact">{t("contact")}</Link>
        {user ? (
          <details className="user-menu">
            <summary aria-label={t("userMenu")}>{displayName(user)}</summary>
            <ul>
              <li>
                <Link href="/accounts">{t("accounts")}</Link>
              </li>
              <li>
                <Link href="/profile">{t("profile")}</Link>
              </li>
              <li>
                <LogoutButton label={t("logout")} />
              </li>
            </ul>
          </details>
        ) : (
          <Link href="/login">{t("loginRegister")}</Link>
        )}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const t = useTranslations("footer");
  return (
    <footer className="site-footer">
      <p>{t("rights")}</p>
      <nav aria-label="legal">
        <Link href="/privacy">{t("privacy")}</Link>
        <Link href="/terms">{t("terms")}</Link>
      </nav>
    </footer>
  );
}
