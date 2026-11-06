"use client";

import { useTranslations } from "next-intl";

import type { ApiErrorCode } from "@/lib/api/errors";

export function ErrorMessage({ code }: { code: ApiErrorCode | null | undefined }) {
  const t = useTranslations("errors");
  if (!code) return null;
  return (
    <p role="alert" className="form-error">
      {t.has(code) ? t(code) : t("internal_error")}
    </p>
  );
}

export function StatusMessage({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="form-status">
      {children}
    </p>
  );
}
