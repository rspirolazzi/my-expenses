import { getLocales } from "expo-localization";

export interface CurrencyOption {
  code: string;
  label: string;
}

// Hermes may not implement Intl.supportedValuesOf, so the list is explicit (ISO 4217).
const CODES = [
  "ARS",
  "AUD",
  "BOB",
  "BRL",
  "CAD",
  "CHF",
  "CLP",
  "CNY",
  "COP",
  "CRC",
  "CZK",
  "DKK",
  "DOP",
  "EUR",
  "GBP",
  "GTQ",
  "HKD",
  "HNL",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "JPY",
  "KRW",
  "MXN",
  "MYR",
  "NIO",
  "NOK",
  "NZD",
  "PAB",
  "PEN",
  "PHP",
  "PLN",
  "PYG",
  "RON",
  "SEK",
  "SGD",
  "THB",
  "TRY",
  "TWD",
  "UAH",
  "USD",
  "UYU",
  "VES",
  "ZAR",
];

export function currencyOptions(locale: string): CurrencyOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: "currency" });
  } catch {
    names = null;
  }
  return CODES.map((code) => ({ code, label: `${code} — ${names?.of(code) ?? code}` }));
}

/** Currency of the device region, or null when unknown: nothing is preselected (FR-020a). */
export function suggestedCurrency(): string | null {
  const code = getLocales()[0]?.currencyCode;
  return code ? code.toUpperCase() : null;
}
