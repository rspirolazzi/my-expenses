import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("home");
  return (
    <section className="hero">
      <h1>{t("title")}</h1>
      <p>{t("subtitle")}</p>
      <Link href="/register" className="button">
        {t("cta")}
      </Link>
    </section>
  );
}
