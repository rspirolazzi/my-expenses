import { getTranslations } from "next-intl/server";

/** Placeholder informational page (content arrives in a later feature). */
export async function InfoPage({ section }: { section: "howItWorks" | "about" | "contact" }) {
  const t = await getTranslations(`pages.${section}`);
  return (
    <article className="card">
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
    </article>
  );
}
