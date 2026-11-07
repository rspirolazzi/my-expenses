import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { AccountForm } from "@/components/accounts/AccountForm";
import { displayName } from "@/lib/displayName";

export default async function NewAccountPage() {
  const [session, t] = await Promise.all([auth(), getTranslations("accounts")]);
  const user = session?.user;
  return (
    <section className="card auth-card">
      <h1>{t("new")}</h1>
      <AccountForm
        defaultCurrency={user?.preferences.defaultCurrency ?? null}
        myName={user ? displayName(user) : ""}
      />
    </section>
  );
}
