import { getTranslations } from "next-intl/server";

import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { RegisterForm } from "@/components/RegisterForm";

export default async function RegisterPage() {
  const t = await getTranslations();
  return (
    <section className="card auth-card">
      <h1>{t("auth.register.title")}</h1>
      <GoogleSignInButton />
      <p className="divider">{t("common.or")}</p>
      <RegisterForm />
    </section>
  );
}
