import { getLocales } from "expo-localization";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import i18n from "@/i18n";
import OnboardingCurrencyScreen from "@/screens/OnboardingCurrencyScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import { usersApi } from "@/services/api/users";

import { renderScreen, user } from "../support/render";

const setUser = jest.fn();
const logout = jest.fn();
const prefs = { setLanguage: jest.fn(), setTheme: jest.fn(), setCurrency: jest.fn(), error: null };

jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return { Link: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> };
});
jest.mock("@/hooks/useAuth", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/services/api/users", () => ({
  usersApi: { updateMe: jest.fn(), requestEmailChange: jest.fn(), confirmEmailChange: jest.fn() },
}));

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage("es");
  (useAuth as jest.Mock).mockReturnValue({ user, setUser, logout });
  (usePreferences as jest.Mock).mockReturnValue(prefs);
});

describe("OnboardingCurrency (FR-020a)", () => {
  it("preselects the device currency and saves it", async () => {
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: "es", currencyCode: "ARS" }]);
    (usersApi.updateMe as jest.Mock).mockResolvedValue(user);
    renderScreen(<OnboardingCurrencyScreen />);
    expect(screen.getByText(/^ARS/)).toBeTruthy();
    expect(screen.getByText("Sugerida según tu región")).toBeTruthy();
    fireEvent.press(screen.getByText("Continuar"));
    await waitFor(() =>
      expect(usersApi.updateMe).toHaveBeenCalledWith({ preferences: { defaultCurrency: "ARS" } }),
    );
    expect(setUser).toHaveBeenCalledWith(user);
  });

  it("preselects nothing without a device currency", () => {
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: "es", currencyCode: null }]);
    renderScreen(<OnboardingCurrencyScreen />);
    expect(screen.getByText("Elegí una moneda")).toBeTruthy();
    expect(screen.queryByText("Sugerida según tu región")).toBeNull();
    fireEvent.press(screen.getByText("Continuar"));
    expect(usersApi.updateMe).not.toHaveBeenCalled();
  });
});

describe("Profile (US5, US6)", () => {
  it("shows the email as name when there is none and saves names", async () => {
    (usersApi.updateMe as jest.Mock).mockResolvedValue({ ...user, firstName: "Ana" });
    renderScreen(<ProfileScreen />);
    expect(screen.getAllByText("ana@mail.com").length).toBeGreaterThan(0);
    fireEvent.changeText(screen.getByLabelText("Nombre"), "Ana");
    fireEvent.press(screen.getByText("Guardar"));
    await waitFor(() =>
      expect(usersApi.updateMe).toHaveBeenCalledWith({ firstName: "Ana", lastName: null }),
    );
  });

  it("changes language and theme through usePreferences", () => {
    renderScreen(<ProfileScreen />);
    fireEvent.press(screen.getByText("English"));
    fireEvent.press(screen.getByText("Oscuro"));
    expect(prefs.setLanguage).toHaveBeenCalledWith("en");
    expect(prefs.setTheme).toHaveBeenCalledWith("dark");
  });

  it("changes the email with a code", async () => {
    (usersApi.requestEmailChange as jest.Mock).mockResolvedValue(undefined);
    (usersApi.confirmEmailChange as jest.Mock).mockResolvedValue({
      ...user,
      email: "new@mail.com",
    });
    renderScreen(<ProfileScreen />);
    fireEvent.changeText(screen.getByLabelText("Email nuevo"), "new@mail.com");
    fireEvent.press(screen.getByText("Enviar código"));
    fireEvent.changeText(await screen.findByLabelText("Código"), "123456");
    await waitFor(() => expect(usersApi.confirmEmailChange).toHaveBeenCalledWith("123456"));
  });

  it("logs out", () => {
    renderScreen(<ProfileScreen />);
    fireEvent.press(screen.getByText("Logout"));
    expect(logout).toHaveBeenCalled();
  });
});
