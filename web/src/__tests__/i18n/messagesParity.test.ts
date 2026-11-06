import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import { negotiateLocale } from "@/i18n/config";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") acc[path] = value;
    else Object.assign(acc, flatten(value, path));
    return acc;
  }, {});
}

it("es and en have exactly the same keys and no empty values (FR-019)", () => {
  const esFlat = flatten(es as Tree);
  const enFlat = flatten(en as Tree);
  expect(Object.keys(esFlat).sort()).toEqual(Object.keys(enFlat).sort());
  for (const value of [...Object.values(esFlat), ...Object.values(enFlat)]) {
    expect(value.trim()).not.toBe("");
  }
});

it("every API error code has a translation", () => {
  const codes = [
    "validation_error",
    "rate_limited",
    "email_unavailable",
    "invalid_code",
    "invalid_credentials",
    "password_login_locked",
    "invalid_google_token",
    "google_email_not_verified",
    "invalid_refresh_token",
    "unauthorized",
    "email_taken",
  ];
  for (const code of codes) {
    expect(es.errors).toHaveProperty(code);
    expect(en.errors).toHaveProperty(code);
  }
});

it("negotiates the language from Accept-Language with es as default", () => {
  expect(negotiateLocale("en-US,en;q=0.9")).toBe("en");
  expect(negotiateLocale("fr-FR,en;q=0.5")).toBe("en");
  expect(negotiateLocale("fr-FR")).toBe("es");
  expect(negotiateLocale(null)).toBe("es");
});
