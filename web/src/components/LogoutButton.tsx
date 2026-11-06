"use client";

import { useTransition } from "react";

import { signOutAction } from "@/app/actions/auth";

/** Ends the session on this device: Auth.js clears the cookie and the backend revokes it. */
export function LogoutButton({ label }: { label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="link-button"
      disabled={pending}
      onClick={() => startTransition(() => signOutAction())}
    >
      {label}
    </button>
  );
}
