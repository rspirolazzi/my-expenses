import { getTranslations } from "next-intl/server";

import { JoinByCodeForm } from "@/components/accounts/JoinByCodeForm";

export default async function JoinPage() {
  const t = await getTranslations("accounts");
  return (
    <section className="card auth-card">
      <h1>{t("join")}</h1>
      <JoinByCodeForm />
    </section>
  );
}
