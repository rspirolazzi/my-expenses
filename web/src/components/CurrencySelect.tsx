"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { currencyOptions } from "@/lib/currencies";

interface CurrencySelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (code: string) => void;
}

export function CurrencySelect({ id, label, value, onChange }: CurrencySelectProps) {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const options = useMemo(() => currencyOptions(locale), [locale]);

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
