import { getTranslations } from "next-intl/server";

import { CodeSignInFlow } from "@/components/CodeSignInFlow";

interface LoginCodePageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function LoginCodePage({ searchParams }: LoginCodePageProps) {
  const { callbackUrl } = await searchParams;
  const t = await getTranslations("auth.loginCode");
  return (
    <section className="card auth-card">
      <h1>{t("title")}</h1>
      <CodeSignInFlow kind="login-code" callbackUrl={callbackUrl} />
    </section>
  );
}
