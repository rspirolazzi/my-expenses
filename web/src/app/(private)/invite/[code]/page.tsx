import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { JoinAccountForm } from "@/components/accounts/JoinAccountForm";
import { getInvitation } from "@/lib/accountsServer";
import { ApiError } from "@/lib/api/errors";
import type { InvitationPreview } from "@/lib/api/types";

interface InvitePageProps {
  params: Promise<{ code: string }>;
}

async function load(code: string): Promise<InvitationPreview | null> {
  try {
    return await getInvitation(code);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Private route: without a session, proxy.ts sends the user to log in and back here (FR-009). */
export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;
  const [preview, t] = await Promise.all([load(code), getTranslations()]);
  if (!preview) {
    return (
      <section className="card auth-card">
        <p role="alert" className="form-error">
          {t("errors.invalid_invitation")}
        </p>
        <Link href="/accounts">{t("accounts.title")}</Link>
      </section>
    );
  }
  return (
    <section className="card auth-card">
      <JoinAccountForm code={code} initialPreview={preview} />
    </section>
  );
}
