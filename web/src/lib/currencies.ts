export interface CurrencyOption {
  code: string;
  label: string;
}

/** ISO 4217 codes known to the runtime, with names localized to the UI language. */
export function currencyOptions(locale: string): CurrencyOption[] {
  const codes: string[] =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("currency") : FALLBACK;
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: "currency" });
  } catch {
    names = null;
  }
  return codes
    .map((code) => ({ code, label: `${code} — ${names?.of(code) ?? code}` }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

const FALLBACK = ["ARS", "BRL", "CLP", "COP", "EUR", "GBP", "MXN", "PEN", "USD", "UYU"];
