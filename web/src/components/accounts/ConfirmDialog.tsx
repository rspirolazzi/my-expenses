"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  /** "danger" for destructive actions (default), "" for a plain confirmation. */
  confirmClassName?: string;
  /** Extra content under the message, such as an error. */
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Explicit confirmation for destructive actions (constitution, Principle IV). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  pending,
  confirmClassName = "danger",
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useTranslations("accounts.dialogs");
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="dialog card">
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        {children}
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" className="secondary" onClick={onCancel}>
            {cancelLabel ?? t("cancel")}
          </button>
          <button type="button" className={confirmClassName} disabled={pending} onClick={onConfirm}>
            {confirmLabel ?? t("continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
