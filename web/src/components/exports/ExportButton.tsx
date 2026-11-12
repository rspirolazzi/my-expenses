"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { fileNameFromDisposition, saveBlob } from "@/lib/download";

type ExportFormat = "csv" | "json";

const FORMATS: ExportFormat[] = ["csv", "json"];

interface ExportButtonProps {
  /** Same-origin Route Handler that forwards the export (research R12). */
  endpoint: string;
  label?: string;
}

/** "Export" menu with CSV and JSON: progress, no double export, clear error and retry (FR-018). */
export function ExportButton({ endpoint, label }: ExportButtonProps) {
  const t = useTranslations("exports");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{ format: ExportFormat; code: string } | null>(null);
  const running = useRef(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function run(format: ExportFormat) {
    if (running.current) return;
    running.current = true;
    setOpen(false);
    setFailed(null);
    setBusy(true);
    try {
      const response = await fetch(`${endpoint}?format=${format}`, { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { code?: string };
        } | null;
        setFailed({ format, code: body?.error?.code ?? "internal_error" });
        return;
      }
      const blob = await response.blob();
      const fallback = `export.${format === "csv" ? "zip" : "json"}`;
      saveBlob(
        blob,
        fileNameFromDisposition(response.headers.get("Content-Disposition"), fallback),
      );
    } catch {
      setFailed({ format, code: "network_error" });
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <span className="export-button">
      <button
        type="button"
        className="button secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-busy={busy}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        {busy ? t("exporting") : (label ?? t("button"))}
      </button>
      {open && (
        <span role="menu" aria-label={t("menuLabel")} className="export-menu">
          {FORMATS.map((format) => (
            <button key={format} type="button" role="menuitem" onClick={() => run(format)}>
              {t(format)}
            </button>
          ))}
        </span>
      )}
      {failed && (
        <span role="alert" className="form-error export-error">
          {failed.code === "not_found" ? t("notFound") : t("error")}{" "}
          <button type="button" className="link-button" onClick={() => run(failed.format)}>
            {t("retry")}
          </button>
        </span>
      )}
    </span>
  );
}
