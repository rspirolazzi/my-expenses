import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { ExportButton } from "@/components/exports/ExportButton";
import { EmailChangeForm, PreferencesForm, ProfileForm } from "@/components/ProfileForms";

export default async function ProfilePage() {
  const [session, t, tExports] = await Promise.all([
    auth(),
    getTranslations("profile"),
    getTranslations("exports"),
  ]);
  if (!session?.user) return null;
  const user = session.user;
  return (
    <section className="card stack">
      <h1>{t("title")}</h1>
      <ProfileForm user={user} />
      <PreferencesForm user={user} />
      <EmailChangeForm user={user} />
      <section className="stack" aria-labelledby="export-mine-title">
        <h2 id="export-mine-title">{tExports("mineTitle")}</h2>
        <p>{tExports("mineHint")}</p>
        <ExportButton endpoint="/api/exports/me" label={tExports("mineButton")} />
      </section>
    </section>
  );
}
