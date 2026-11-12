import { useTranslations } from "next-intl";

export const LEGAL_SECTIONS = {
  privacy: ["data", "use", "members", "providers", "history", "export", "questions"],
  terms: ["service", "access", "balances", "data", "changes"],
} as const;

export type LegalPageKind = keyof typeof LEGAL_SECTIONS;

/** Privacy and Terms pages linked from the footer; texts live in the es/en catalogs. */
export function LegalPage({ kind }: { kind: LegalPageKind }) {
  const t = useTranslations(`legal.${kind}`);
  const common = useTranslations("legal");
  return (
    <article className="card stack">
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>
      {LEGAL_SECTIONS[kind].map((section) => (
        <section key={section} className="stack" aria-labelledby={`legal-${section}`}>
          <h2 id={`legal-${section}`}>{t(`sections.${section}.title`)}</h2>
          <p>{t(`sections.${section}.body`)}</p>
        </section>
      ))}
      <p>
        <small>{common("lastUpdated")}</small>
      </p>
    </article>
  );
}
