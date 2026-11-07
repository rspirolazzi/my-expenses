import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Dialog, IconButton, Portal, Text, useTheme } from "react-native-paper";

import type { AccountIcon as Icon } from "../../services/api/types";
import { ACCOUNT_ICONS, MATERIAL_ICON } from "../../utils/accountIcons";

export function AccountIcon({ icon, size = 28 }: { icon: Icon; size?: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <MaterialCommunityIcons
      name={MATERIAL_ICON[icon] as never}
      size={size}
      color={theme.colors.primary}
      accessibilityLabel={t(`accounts.icons.${icon}`)}
    />
  );
}

export function IconPicker({ value, onChange }: { value: Icon; onChange: (icon: Icon) => void }) {
  const { t } = useTranslation();
  return (
    <View>
      <Text variant="labelLarge">{t("accounts.form.icon")}</Text>
      <View style={styles.icons}>
        {ACCOUNT_ICONS.map((icon) => (
          <IconButton
            key={icon}
            icon={MATERIAL_ICON[icon]}
            mode={icon === value ? "contained" : undefined}
            selected={icon === value}
            accessibilityLabel={t(`accounts.icons.${icon}`)}
            accessibilityState={{ selected: icon === value }}
            onPress={() => onChange(icon)}
          />
        ))}
      </View>
    </View>
  );
}

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Explicit confirmation for destructive actions (constitution, Principle IV). */
export function ConfirmDialog({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onCancel}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text>{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel}>{t("accounts.dialogs.cancel")}</Button>
          <Button onPress={onConfirm}>{t("accounts.dialogs.continue")}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  icons: { flexDirection: "row", flexWrap: "wrap" },
});
