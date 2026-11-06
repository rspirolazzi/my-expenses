import { getTranslations } from "next-intl/server";

import { OnboardingCurrencyForm } from "@/components/OnboardingCurrencyForm";

export default async function OnboardingCurrencyPage() {
  const t = await getTranslations("onboarding");
  return (
    <section className="card auth-card">
      <h1>{t("title")}</h1>
      <OnboardingCurrencyForm />
    </section>
  );
}
