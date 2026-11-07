import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { Button, RadioButton, Text, TextInput } from "react-native-paper";

import { AccountIcon } from "../../components/accounts/AccountBits";
import { ErrorText, formStyles } from "../../components/FormBits";
import { accountsApi } from "../../services/api/accounts";
import { type ApiErrorCode, errorCodeOf, type InvitationPreview } from "../../services/api/types";
import {
  extractInviteCode,
  isValidParticipantName,
  PARTICIPANT_NAME_MAX,
} from "../../utils/accountIcons";

/** "Unirme con un código": accepts the bare code or a pasted link. */
export function JoinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  function submit() {
    const code = extractInviteCode(value);
    setInvalid(code === null);
    if (code) router.push({ pathname: "/invite/[code]", params: { code } });
  }

  return (
    <ScrollView contentContainerStyle={formStyles.screen} keyboardShouldPersistTaps="handled">
      <Text variant="headlineMedium">{t("accounts.join")}</Text>
      <TextInput
        mode="outlined"
        label={t("invite.codeLabel")}
        accessibilityLabel={t("invite.codeLabel")}
        autoCapitalize="none"
        value={value}
        onChangeText={setValue}
      />
      {invalid && <ErrorText code="invalid_invitation" />}
      <Button mode="contained" onPress={submit}>
        {t("invite.continue")}
      </Button>
    </ScrollView>
  );
}

/** Pick which participant you are, or add yourself (FR-010). */
export function InvitationScreen({ code }: { code: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [selected, setSelected] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    accountsApi
      .previewInvitation(code)
      .then(setPreview)
      .catch((err) => setError(errorCodeOf(err)));
  }, [code]);

  const openAccount = (accountId: string) =>
    router.replace({ pathname: "/accounts/[accountId]", params: { accountId } });

  async function join(choice: { participantId: string } | { newParticipantName: string }) {
    setPending(true);
    setError(null);
    try {
      const account = await accountsApi.acceptInvitation(code, choice);
      openAccount(account.id);
    } catch (err) {
      const errorCode = errorCodeOf(err);
      setError(errorCode);
      if (errorCode === "participant_taken" || errorCode === "already_member") {
        setSelected("");
        setPreview(await accountsApi.previewInvitation(code).catch(() => preview));
      }
    } finally {
      setPending(false);
    }
  }

  if (!preview) {
    return (
      <ScrollView contentContainerStyle={formStyles.screen}>
        <ErrorText code={error} />
      </ScrollView>
    );
  }

  if (preview.alreadyMember && preview.accountId) {
    const accountId = preview.accountId;
    return (
      <ScrollView contentContainerStyle={formStyles.screen}>
        <Text accessibilityRole="alert">{t("invite.alreadyMember")}</Text>
        <Button mode="contained" onPress={() => openAccount(accountId)}>
          {t("invite.open")}
        </Button>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={formStyles.screen} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <AccountIcon icon={preview.icon} size={36} />
        <View>
          <Text variant="headlineSmall">{t("invite.title", { name: preview.accountName })}</Text>
          <Text>{t("invite.currency", { currency: preview.currency })}</Text>
        </View>
      </View>
      {preview.availableParticipants.length > 0 ? (
        <>
          <Text variant="titleMedium">{t("invite.choose")}</Text>
          <RadioButton.Group value={selected} onValueChange={setSelected}>
            {preview.availableParticipants.map((p) => (
              <RadioButton.Item
                key={p.id}
                label={p.name}
                value={p.id}
                accessibilityLabel={p.name}
              />
            ))}
          </RadioButton.Group>
          <Button
            mode="contained"
            disabled={!selected || pending}
            onPress={() => join({ participantId: selected })}
          >
            {t("invite.join")}
          </Button>
        </>
      ) : (
        <Text>{t("invite.noneAvailable")}</Text>
      )}
      <Text>{t("invite.orNew")}</Text>
      <TextInput
        mode="outlined"
        label={t("invite.newName")}
        accessibilityLabel={t("invite.newName")}
        maxLength={PARTICIPANT_NAME_MAX}
        value={newName}
        onChangeText={setNewName}
      />
      <Button
        mode="outlined"
        disabled={pending || !isValidParticipantName(newName)}
        onPress={() => join({ newParticipantName: newName.trim() })}
      >
        {t("invite.joinAsNew")}
      </Button>
      <ErrorText code={error} />
    </ScrollView>
  );
}
