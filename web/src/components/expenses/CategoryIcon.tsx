"use client";

import { useTranslations } from "next-intl";

import type { CategoryIcon as Category } from "@/lib/api/types";
import { CATEGORY_GLYPHS, CATEGORY_ICONS } from "@/lib/categoryIcons";

export function CategoryIcon({ icon, size = "1.5rem" }: { icon: Category; size?: string }) {
  const t = useTranslations("expenses.categories");
  return (
    <span role="img" aria-label={t(icon)} style={{ fontSize: size }}>
      {CATEGORY_GLYPHS[icon]}
    </span>
  );
}

interface CategoryPickerProps {
  value: Category;
  onChange: (icon: Category) => void;
  disabled?: boolean;
}

export function CategoryPicker({ value, onChange, disabled }: CategoryPickerProps) {
  const t = useTranslations("expenses");
  return (
    <fieldset className="icon-picker" disabled={disabled}>
      <legend>{t("form.category")}</legend>
      {CATEGORY_ICONS.map((icon) => (
        <label
          key={icon}
          className={icon === value ? "selected" : undefined}
          title={t(`categories.${icon}`)}
        >
          <input
            type="radio"
            name="expense-category"
            value={icon}
            checked={icon === value}
            onChange={() => onChange(icon)}
            aria-label={t(`categories.${icon}`)}
          />
          <span aria-hidden="true">{CATEGORY_GLYPHS[icon]}</span>
        </label>
      ))}
    </fieldset>
  );
}
