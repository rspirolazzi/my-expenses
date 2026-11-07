"use client";

import { useTranslations } from "next-intl";

import { ACCOUNT_ICON_GLYPHS, ACCOUNT_ICONS } from "@/lib/accountIcons";
import type { AccountIcon as Icon } from "@/lib/api/types";

export function AccountIcon({ icon, size = "1.5rem" }: { icon: Icon; size?: string }) {
  const t = useTranslations("accounts.icons");
  return (
    <span role="img" aria-label={t(icon)} style={{ fontSize: size }}>
      {ACCOUNT_ICON_GLYPHS[icon]}
    </span>
  );
}

interface IconPickerProps {
  value: Icon;
  onChange: (icon: Icon) => void;
  disabled?: boolean;
}

export function IconPicker({ value, onChange, disabled }: IconPickerProps) {
  const t = useTranslations("accounts");
  return (
    <fieldset className="icon-picker" disabled={disabled}>
      <legend>{t("form.icon")}</legend>
      {ACCOUNT_ICONS.map((icon) => (
        <label key={icon} className={icon === value ? "selected" : undefined}>
          <input
            type="radio"
            name="account-icon"
            value={icon}
            checked={icon === value}
            onChange={() => onChange(icon)}
            aria-label={t(`icons.${icon}`)}
          />
          <span aria-hidden="true">{ACCOUNT_ICON_GLYPHS[icon]}</span>
        </label>
      ))}
    </fieldset>
  );
}
