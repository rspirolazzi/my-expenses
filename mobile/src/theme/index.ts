import { useColorScheme } from "react-native";
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from "react-native-paper";

import type { ThemeName } from "../services/api/types";

const brand = { primary: "#1f6feb" };

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: { ...MD3LightTheme.colors, primary: brand.primary },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: { ...MD3DarkTheme.colors, primary: "#58a6ff" },
};

/** Paper theme for the user's preference; `system` follows the device (FR-021). */
export function useAppTheme(preference: ThemeName | undefined): MD3Theme {
  const scheme = useColorScheme();
  const effective = !preference || preference === "system" ? scheme : preference;
  return effective === "dark" ? darkTheme : lightTheme;
}
