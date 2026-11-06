import { useColorScheme } from "react-native";

import { darkTheme, lightTheme, useAppTheme } from "@/theme";
import { displayName } from "@/utils/displayName";
import { validateEmail, validateName, validatePassword } from "@/utils/validation";

jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe("displayName (FR-017)", () => {
  it("uses the names or falls back to the email", () => {
    expect(displayName({ email: "a@b.com", firstName: "Ana", lastName: "Paz" })).toBe("Ana Paz");
    expect(displayName({ email: "a@b.com", firstName: null, lastName: null })).toBe("a@b.com");
  });
});

describe("validation", () => {
  it("matches the web rules", () => {
    expect(validateEmail("bad")).toBe("emailInvalid");
    expect(validatePassword("1234567", "a@b.com")).toBe("passwordTooShort");
    expect(validatePassword("Ana@Mail.com", "ana@mail.com")).toBe("passwordEqualsEmail");
    expect(validateName("x".repeat(61))).toBe("nameTooLong");
  });
});

describe("useAppTheme (FR-021)", () => {
  it("follows the device with system and honours explicit choices", () => {
    (useColorScheme as jest.Mock).mockReturnValue("dark");
    expect(useAppTheme("system")).toBe(darkTheme);
    expect(useAppTheme("light")).toBe(lightTheme);
    (useColorScheme as jest.Mock).mockReturnValue("light");
    expect(useAppTheme("system")).toBe(lightTheme);
    expect(useAppTheme("dark")).toBe(darkTheme);
  });
});
