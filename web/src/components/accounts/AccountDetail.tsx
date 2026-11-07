"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { AccountResponse } from "@/lib/api/types";

import { AccountIcon } from "./AccountIcon";
import { AccountActions } from "./AccountActions";
import { AccountEditForm } from "./AccountEditForm";
import { InvitePanel } from "./InvitePanel";
import { ParticipantList } from "./ParticipantList";

export function AccountDetail({ initialAccount }: { initialAccount: AccountResponse }) {
  const t = useTranslations("accounts");
  const router = useRouter();
  const [account, setAccount] = useState(initialAccount);

  function update(next: AccountResponse) {
    setAccount(next);
    router.refresh();
  }

  return (
    <section className="card stack">
      <header className="row">
        <AccountIcon icon={account.icon} size="2rem" />
        <div>
          <h1>{account.name}</h1>
          <small>{t("detail.currency", { currency: account.currency })}</small>
        </div>
      </header>
      {account.description && <p>{account.description}</p>}
      {account.isClosed && (
        <p role="status" className="badge">
          {t("detail.closedNotice")}
        </p>
      )}
      <ParticipantList
        account={account}
        onChange={update}
        onRemovedSelf={() => {
          router.push("/accounts");
          router.refresh();
        }}
      />
      <InvitePanel account={account} onChange={update} />
      <AccountEditForm key={account.updatedAt} account={account} onChange={update} />
      <AccountActions account={account} onChange={update} />
    </section>
  );
}
