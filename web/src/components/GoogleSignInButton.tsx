"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { googleSignInAction } from "@/app/actions/auth";

export function GoogleSignInButton({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations("auth.google");
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="google-button"
      disabled={pending}
      onClick={() => startTransition(() => googleSignInAction(callbackUrl))}
    >
      {t("button")}
    </button>
  );
}
