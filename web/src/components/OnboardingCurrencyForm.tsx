"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

import { updateMeAction } from "@/app/actions/profile";
import type { ApiErrorCode } from "@/lib/api/errors";
import { suggestCurrency } from "@/lib/currencySuggestion";

import { CurrencySelect } from "./CurrencySelect";
import { ErrorMessage } from "./FormMessage";

interface OnboardingCurrencyFormProps {
  /** Overrides the browser languages (used by tests). */
  languages?: readonly string[];
}

const noopSubscribe = () => () => undefined;

export function OnboardingCurrencyForm({ languages }: OnboardingCurrencyFormProps) {
  const t = useTranslations();
  const router = useRouter();
  // Suggested from the device region; nothing is preselected when it is unknown (FR-020a).
  const suggestion = useSyncExternalStore(
    noopSubscribe,
    () => suggestCurrency(languages ?? navigator.languages ?? []),
    () => null,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const currency = selected ?? suggestion ?? "";
  const suggested = selected === null && suggestion !== null;
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  async function handleContinue() {
    setPending(true);
    const result = await updateMeAction({ preferences: { defaultCurrency: currency } });
    setPending(false);
    if (!result.ok) {
      setError(result.code);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="form">
      <p>{t("onboarding.intro")}</p>
      <CurrencySelect
        id="onboarding-currency"
        label={t("onboarding.currency")}
        value={currency}
        onChange={setSelected}
      />
      {suggested && <small>{t("onboarding.suggested")}</small>}
      <ErrorMessage code={error} />
      <button type="button" disabled={!currency || pending} onClick={handleContinue}>
        {t("common.continue")}
      </button>
    </div>
  );
}
