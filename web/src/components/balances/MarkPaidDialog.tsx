"use client";

import { useLocale, useTranslations } from "next-intl";

import { ConfirmDialog } from "@/components/accounts/ConfirmDialog";
import { ErrorMessage } from "@/components/FormMessage";
import type { ApiErrorCode } from "@/lib/api/errors";
import type { SuggestedTransfer } from "@/lib/api/types";
import { formatDay } from "@/lib/expenseGroups";
import { formatMoney } from "@/lib/money";

interface MarkPaidDialogProps {
  suggestion: SuggestedTransfer | null;
  currency: string;
  decimals: number;
  /** Today in the device's time zone, computed when the dialog opened. */
  date: string;
  pending: boolean;
  error: ApiErrorCode | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Fixed data, nothing editable (FR-012): other amounts or dates go through the manual form. */
export function MarkPaidDialog({
  suggestion,
  currency,
  decimals,
  date,
  pending,
  error,
  onConfirm,
  onCancel,
}: MarkPaidDialogProps) {
  const t = useTranslations("balances");
  const locale = useLocale();
  return (
    <ConfirmDialog
      open={suggestion !== null}
      title={t("dialogTitle")}
      message={
        suggestion
          ? t("dialogBody", {
              from: suggestion.from.name,
              to: suggestion.to.name,
              amount: formatMoney(suggestion.amount, currency, decimals, locale),
              date: formatDay(date, locale, { dateStyle: "long" }),
            })
          : ""
      }
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      confirmClassName=""
      pending={pending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <small>{t("dialogHint")}</small>
      <ErrorMessage code={error} />
    </ConfirmDialog>
  );
}
