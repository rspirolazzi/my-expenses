import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { displayName } from "@/lib/displayName";

export default async function DashboardPage() {
  const [session, t] = await Promise.all([auth(), getTranslations("dashboard")]);
  const name = session?.user ? displayName(session.user) : "";
  return (
    <section className="card">
      <h1>{t("title", { name })}</h1>
      <p>{t("empty")}</p>
    </section>
  );
}
