import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SegmentedButtons } from "react-native-paper";

export type AccountTab = "expenses" | "balances";

/** "Gastos" and "Saldos" tabs of an account (FR-000); switching replaces the current screen. */
export function AccountTabs({ accountId, active }: { accountId: string; active: AccountTab }) {
  const { t } = useTranslation();
  const router = useRouter();

  function select(value: string) {
    if (value === active) return;
    if (value === "balances") {
      router.replace({ pathname: "/accounts/[accountId]/balances", params: { accountId } });
    } else {
      router.replace({ pathname: "/accounts/[accountId]", params: { accountId } });
    }
  }

  return (
    <SegmentedButtons
      value={active}
      onValueChange={select}
      buttons={[
        { value: "expenses", label: t("tabs.expenses") },
        { value: "balances", label: t("tabs.balances") },
      ]}
    />
  );
}
