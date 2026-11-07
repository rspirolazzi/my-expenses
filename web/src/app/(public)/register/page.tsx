import { getTranslations } from "next-intl/server";

import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { RegisterForm } from "@/components/RegisterForm";

interface RegisterPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { callbackUrl } = await searchParams;
  const t = await getTranslations();
  return (
    <section className="card auth-card">
      <h1>{t("auth.register.title")}</h1>
      <GoogleSignInButton callbackUrl={callbackUrl} />
      <p className="divider">{t("common.or")}</p>
      <RegisterForm callbackUrl={callbackUrl} />
    </section>
  );
}
