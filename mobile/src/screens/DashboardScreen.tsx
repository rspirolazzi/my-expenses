import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import { Text } from "react-native-paper";

import { formStyles } from "../components/FormBits";
import { useAuth } from "../hooks/useAuth";
import { displayName } from "../utils/displayName";

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <ScrollView contentContainerStyle={formStyles.screen}>
      <Text variant="headlineMedium">
        {t("dashboard.title", { name: user ? displayName(user) : "" })}
      </Text>
      <Text>{t("dashboard.empty")}</Text>
      <Link href="/profile">{t("nav.profile")}</Link>
    </ScrollView>
  );
}
