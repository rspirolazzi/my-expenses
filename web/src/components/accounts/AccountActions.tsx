"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  closeAccountAction,
  deleteAccountAction,
  leaveAccountAction,
} from "@/app/actions/accounts";
import { ErrorMessage } from "@/components/FormMessage";
import type { ApiErrorCode } from "@/lib/api/errors";
import type { AccountResponse } from "@/lib/api/types";

import { ConfirmDialog } from "./ConfirmDialog";

type Pending = "leave" | "close" | "delete" | null;

interface AccountActionsProps {
  account: AccountResponse;
  onChange: (account: AccountResponse) => void;
}

/** Leave (members), close and delete (Owner only), each behind a confirmation dialog. */
export function AccountActions({ account, onChange }: AccountActionsProps) {
  const t = useTranslations("accounts");
  const router = useRouter();
  const [dialog, setDialog] = useState<Pending>(null);
  const [error, setError] = useState<ApiErrorCode | null>(null);

  function goToList() {
    router.push("/accounts");
    router.refresh();
  }

  async function confirm() {
    const action = dialog;
    setDialog(null);
    setError(null);
    if (action === "leave") {
      const result = await leaveAccountAction(account.id);
      return result.ok ? goToList() : setError(result.code);
    }
    if (action === "close") {
      const result = await closeAccountAction(account.id);
      return result.ok ? onChange(result.data) : setError(result.code);
    }
    if (action === "delete") {
      const result = await deleteAccountAction(account.id);
      return result.ok ? goToList() : setError(result.code);
    }
  }

  const texts = {
    leave: [t("dialogs.leaveTitle"), t("dialogs.leaveBody")],
    close: [t("dialogs.closeTitle"), t("dialogs.closeBody")],
    delete: [t("dialogs.deleteTitle"), t("dialogs.deleteBody")],
  } as const;

  return (
    <section className="row">
      {!account.isOwner && !account.isClosed && (
        <button type="button" className="secondary" onClick={() => setDialog("leave")}>
          {t("actions.leave")}
        </button>
      )}
      {account.isOwner && !account.isClosed && (
        <button type="button" className="secondary" onClick={() => setDialog("close")}>
          {t("actions.close")}
        </button>
      )}
      {account.isOwner && (
        <button type="button" className="danger" onClick={() => setDialog("delete")}>
          {t("actions.delete")}
        </button>
      )}
      <ErrorMessage code={error} />
      <ConfirmDialog
        open={dialog !== null}
        title={dialog ? texts[dialog][0] : ""}
        message={dialog ? texts[dialog][1] : ""}
        onCancel={() => setDialog(null)}
        onConfirm={confirm}
      />
    </section>
  );
}
