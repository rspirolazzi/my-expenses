import { getTranslations } from "next-intl/server";

import { VerifyEmailForm } from "@/components/VerifyEmailForm";

export default async function VerifyEmailPage() {
  const t = await getTranslations("auth.verifyEmail");
  return (
    <section className="card auth-card">
      <h1>{t("title")}</h1>
      <VerifyEmailForm />
    </section>
  );
}
