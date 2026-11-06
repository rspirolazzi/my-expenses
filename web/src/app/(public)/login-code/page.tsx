import { getTranslations } from "next-intl/server";

import { CodeSignInFlow } from "@/components/CodeSignInFlow";

export default async function LoginCodePage() {
  const t = await getTranslations("auth.loginCode");
  return (
    <section className="card auth-card">
      <h1>{t("title")}</h1>
      <CodeSignInFlow kind="login-code" />
    </section>
  );
}
