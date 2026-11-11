import Link from "next/link";
import { useTranslations } from "next-intl";

export type AccountTab = "expenses" | "balances";

/** "Gastos" and "Saldos" tabs of an account (FR-000). Each tab is its own route. */
export function AccountTabs({ accountId, active }: { accountId: string; active: AccountTab }) {
  const t = useTranslations("tabs");
  const base = `/accounts/${encodeURIComponent(accountId)}`;
  const tabs: { key: AccountTab; href: string }[] = [
    { key: "expenses", href: base },
    { key: "balances", href: `${base}/balances` },
  ];
  return (
    <nav aria-label={t("label")} className="tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={tab.key === active ? "tab active" : "tab"}
          aria-current={tab.key === active ? "page" : undefined}
        >
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}
