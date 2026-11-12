import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Sharing from "expo-sharing";

import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import i18n from "@/i18n";
import ProfileScreen from "@/screens/ProfileScreen";
import { exportsApi } from "@/services/api/exports";

import { renderScreen, user } from "../support/render";

jest.mock("@/hooks/useAuth", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/services/api/exports", () => ({
  exportsApi: { mine: jest.fn(), account: jest.fn() },
}));

const mine = exportsApi.mine as jest.Mock;

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage("es");
  (useAuth as jest.Mock).mockReturnValue({ user, setUser: jest.fn(), logout: jest.fn() });
  (usePreferences as jest.Mock).mockReturnValue({
    setLanguage: jest.fn(),
    setTheme: jest.fn(),
    setCurrency: jest.fn(),
    error: null,
  });
});

it("exports all my data from the profile and shares the file (US2)", async () => {
  mine.mockResolvedValue({
    bytes: new Uint8Array([1]),
    fileName: "chepagame_2026-11-12.json",
    mimeType: "application/json; charset=utf-8",
  });
  renderScreen(<ProfileScreen />);
  expect(screen.getAllByText("Exportar mis datos").length).toBeGreaterThan(0);
  fireEvent.press(screen.getByRole("button", { name: "Exportar mis datos" }));
  fireEvent.press(await screen.findByText("JSON"));
  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledTimes(1));
  expect(mine).toHaveBeenCalledWith("json");
});
