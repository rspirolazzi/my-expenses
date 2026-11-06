import { getTranslations } from "next-intl/server";

import { CodeSignInFlow } from "@/components/CodeSignInFlow";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgotPassword");
  return (
    <section className="card auth-card">
      <h1>{t("title")}</h1>
      <CodeSignInFlow kind="password-reset" />
    </section>
  );
}
