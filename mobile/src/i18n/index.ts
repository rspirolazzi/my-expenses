import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import es from "./locales/es.json";

export const LANGUAGES = ["es", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Device language if supported, otherwise Spanish (FR-019). */
export function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode?.toLowerCase();
  return (LANGUAGES as readonly string[]).includes(code ?? "") ? (code as Language) : "es";
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: deviceLanguage(),
    fallbackLng: "es",
    // The catalogs are shared with the web (next-intl), which uses single braces: {name}.
    interpolation: { escapeValue: false, prefix: "{", suffix: "}" },
    returnNull: false,
  });
}

export default i18n;
