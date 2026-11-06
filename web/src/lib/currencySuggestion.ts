import countryToCurrency from "country-to-currency";

/**
 * Suggest a default currency from the browser languages (FR-020a). Uses the region of the first
 * language that has one (maximizing e.g. "en" to "en-Latn-US"); returns null when unknown.
 */
export function suggestCurrency(languages: readonly string[]): string | null {
  for (const tag of languages) {
    try {
      const region = new Intl.Locale(tag).maximize().region;
      const currency = region ? (countryToCurrency as Record<string, string>)[region] : undefined;
      if (currency) return currency;
    } catch {
      // Ignore malformed language tags.
    }
  }
  return null;
}
