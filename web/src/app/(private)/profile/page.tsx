import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { EmailChangeForm, PreferencesForm, ProfileForm } from "@/components/ProfileForms";

export default async function ProfilePage() {
  const [session, t] = await Promise.all([auth(), getTranslations("profile")]);
  if (!session?.user) return null;
  const user = session.user;
  return (
    <section className="card stack">
      <h1>{t("title")}</h1>
      <ProfileForm user={user} />
      <PreferencesForm user={user} />
      <EmailChangeForm user={user} />
    </section>
  );
}
