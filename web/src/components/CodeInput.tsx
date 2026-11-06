"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";

import type { ActionResult } from "@/lib/api/errors";

interface CodeInputProps {
  label: string;
  onComplete: (code: string) => void;
  disabled?: boolean;
}

/** Single field for a 6-digit code; accepts pasting the whole code and submits when complete. */
export function CodeInput({ label, onComplete, disabled }: CodeInputProps) {
  const id = useId();
  const [value, setValue] = useState("");

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    setValue(digits);
    if (digits.length === 6) onComplete(digits);
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        pattern="\d{6}"
        className="code-input"
        value={value}
        disabled={disabled}
        onChange={(event) => handleChange(event.target.value)}
      />
    </div>
  );
}

interface ResendButtonProps {
  onResend: () => Promise<ActionResult>;
  /** Seconds to wait before the first resend (a code was just sent). */
  initialCooldown?: number;
  onError?: (result: Extract<ActionResult, { ok: false }>) => void;
}

/** Resend button with a countdown; honours `retryAfterSeconds` from `rate_limited`. */
export function ResendButton({ onResend, initialCooldown = 60, onError }: ResendButtonProps) {
  const t = useTranslations("auth.code");
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleClick() {
    const result = await onResend();
    if (result.ok) {
      setSent(true);
      setCooldown(60);
    } else {
      if (result.code === "rate_limited" && result.retryAfterSeconds) {
        setCooldown(result.retryAfterSeconds);
      }
      onError?.(result);
    }
  }

  return (
    <div>
      <button type="button" className="link-button" disabled={cooldown > 0} onClick={handleClick}>
        {cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("resend")}
      </button>
      {sent && <p role="status">{t("resent")}</p>}
    </div>
  );
}
