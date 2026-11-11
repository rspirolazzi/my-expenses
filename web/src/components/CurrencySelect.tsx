"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { currencyOptions } from "@/lib/currencies";
import { useHydrated } from "@/lib/useHydrated";

interface CurrencySelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (code: string) => void;
}

export function CurrencySelect({ id, label, value, onChange }: CurrencySelectProps) {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const hydrated = useHydrated();
  // The currency list and names come from the runtime's ICU data, which differs between the
  // server's Node and the user's browser (e.g. "SLL" vs "SLE"). Rendering it on the server made
  // hydration fail and React re-render the whole page on the client. Until hydrated, render only
  // the selected code, which is identical on both sides.
  const options = useMemo(
    () => (hydrated ? currencyOptions(locale) : value ? [{ code: value, label: value }] : []),
    [hydrated, locale, value],
  );

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="" disabled>
          {t("placeholder")}
        </option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
