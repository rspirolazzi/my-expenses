/**
 * Exact money in the client (Principle III, research R1). Amounts travel as decimal text
 * ("100.50"); this module never turns them into a JavaScript number to compute with.
 */

export const MAX_MAJOR_AMOUNT = "999999999";

export type AmountError =
  | "amountEmpty"
  | "amountInvalid"
  | "amountTooManyDecimals"
  | "amountNotPositive"
  | "amountTooLarge";

export type ParsedAmount = { ok: true; value: string } | { ok: false; error: AmountError };

function separators(locale: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  return {
    group: parts.find((p) => p.type === "group")?.value ?? ",",
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
  };
}

/**
 * What the user typed, in their language ("1.234,50" in es, "1,234.50" in en), to the API's
 * decimal text ("1234.50"). A lone separator followed by digits is read as decimal either way
 * ("100,5" and "100.5") unless it is clearly a thousands group of the locale.
 */
export function parseAmountInput(text: string, locale: string, decimals: number): ParsedAmount {
  const raw = text.replace(/\s/g, "");
  if (!raw) return { ok: false, error: "amountEmpty" };
  if (raw.startsWith("-")) return { ok: false, error: "amountNotPositive" };
  if (!/^[\d.,']+$/.test(raw)) return { ok: false, error: "amountInvalid" };

  const { group, decimal } = separators(locale);
  let normalized: string;
  const lastSep = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
  if (lastSep === -1) {
    normalized = raw;
  } else {
    const sepChar = raw[lastSep];
    const intPart = raw.slice(0, lastSep);
    const fraction = raw.slice(lastSep + 1);
    const looksLikeGroup =
      sepChar === group && sepChar !== decimal && fraction.length === 3 && !/[.,]/.test(fraction);
    if (looksLikeGroup && decimals !== 3) {
      normalized = raw.split(sepChar).join("");
    } else {
      // The decimal separator can only appear once.
      if (intPart.includes(sepChar)) return { ok: false, error: "amountInvalid" };
      normalized = `${intPart.replace(/[.,']/g, "")}.${fraction}`;
    }
  }
  normalized = normalized.replace(/'/g, "");
  if (!/^\d*(\.\d*)?$/.test(normalized) || normalized === "." || normalized === "") {
    return { ok: false, error: "amountInvalid" };
  }

  let [whole, fraction = ""] = normalized.split(".");
  whole = whole.replace(/^0+(?=\d)/, "") || "0";
  fraction = fraction.replace(/0+$/, "");
  if (fraction.length > decimals) return { ok: false, error: "amountTooManyDecimals" };
  if (/^0*$/.test(whole) && /^0*$/.test(fraction)) return { ok: false, error: "amountNotPositive" };
  if (
    whole.length > MAX_MAJOR_AMOUNT.length ||
    (whole.length === MAX_MAJOR_AMOUNT.length && whole > MAX_MAJOR_AMOUNT)
  ) {
    return { ok: false, error: "amountTooLarge" };
  }
  return { ok: true, value: decimals === 0 ? whole : `${whole}.${fraction.padEnd(decimals, "0")}` };
}

/** The API's decimal text back into what the user would type in their language. */
export function amountToInput(amount: string, locale: string): string {
  const { decimal } = separators(locale);
  return amount.replace(".", decimal);
}

/**
 * Formats decimal text with the currency of the account. Intl accepts the string as is, so no
 * precision is lost on the way.
 */
export function formatMoney(
  amount: string,
  currency: string,
  decimals: number,
  locale: string,
): string {
  const format = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format as (value: string) => string;
  return format(amount);
}
