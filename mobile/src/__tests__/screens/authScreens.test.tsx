import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { useAuth } from "@/hooks/useAuth";
import i18n from "@/i18n";
import CodeSignInScreen from "@/screens/CodeSignInScreen";
import LoginScreen from "@/screens/LoginScreen";
import RegisterScreen from "@/screens/RegisterScreen";
import VerifyEmailScreen from "@/screens/VerifyEmailScreen";
import { authApi } from "@/services/api/auth";
import { ApiError } from "@/services/api/types";

import { authResponse, renderScreen } from "../support/render";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
let mockParams: Record<string, string> = {};
const mockSignIn = jest.fn();

jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    Link: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});
jest.mock("@/hooks/useAuth", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/api/auth", () => ({
  authApi: {
    register: jest.fn(),
    resendRegistration: jest.fn(),
    verifyRegistration: jest.fn(),
    loginWithPassword: jest.fn(),
    requestLoginCode: jest.fn(),
    verifyLoginCode: jest.fn(),
    requestPasswordReset: jest.fn(),
    confirmPasswordReset: jest.fn(),
  },
}));
jest.mock("@/services/auth/googleSignIn", () => ({ signInWithGoogle: jest.fn() }));

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  await i18n.changeLanguage("es");
  (useAuth as jest.Mock).mockReturnValue({ signInWithTokens: mockSignIn, sessionExpired: false });
});

describe("Login", () => {
  it("signs in with the password", async () => {
    (authApi.loginWithPassword as jest.Mock).mockResolvedValue(authResponse);
    renderScreen(<LoginScreen />);
    fireEvent.changeText(screen.getByLabelText("Email"), "ana@mail.com");
    fireEvent.changeText(screen.getByLabelText("Contraseña"), "secret-123");
    fireEvent.press(screen.getByText("Entrar"));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith(authResponse));
  });

  it("shows the remaining minutes when locked", async () => {
    (authApi.loginWithPassword as jest.Mock).mockRejectedValue(
      new ApiError(423, "password_login_locked", 120),
    );
    renderScreen(<LoginScreen />);
    fireEvent.changeText(screen.getByLabelText("Email"), "ana@mail.com");
    fireEvent.changeText(screen.getByLabelText("Contraseña"), "wrong");
    fireEvent.press(screen.getByText("Entrar"));
    expect(await screen.findByText(/2 minutos/)).toBeTruthy();
  });

  it("tells the user the session expired", () => {
    (useAuth as jest.Mock).mockReturnValue({ signInWithTokens: mockSignIn, sessionExpired: true });
    renderScreen(<LoginScreen />);
    expect(screen.getByText("Tu sesión venció. Volvé a entrar para seguir.")).toBeTruthy();
  });
});

describe("Register", () => {
  it("validates the password like the web (FR-007)", async () => {
    renderScreen(<RegisterScreen />);
    fireEvent.changeText(screen.getByLabelText("Email"), "ana@mail.com");
    fireEvent.changeText(screen.getByLabelText("Contraseña"), "ana@mail.com");
    fireEvent.press(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByText("La contraseña no puede ser igual al email.")).toBeTruthy();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it("registers and opens the verification screen", async () => {
    (authApi.register as jest.Mock).mockResolvedValue(undefined);
    renderScreen(<RegisterScreen />);
    fireEvent.changeText(screen.getByLabelText("Email"), "ana@mail.com");
    fireEvent.changeText(screen.getByLabelText("Contraseña"), "secret-123");
    fireEvent.press(screen.getByRole("button", { name: "Crear cuenta" }));
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: "/verify-email",
        params: { email: "ana@mail.com" },
      }),
    );
    expect(authApi.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ana@mail.com", language: "es" }),
    );
  });
});

describe("VerifyEmail", () => {
  it("signs in with the code and lets the user fix the email", async () => {
    mockParams = { email: "ana@mail.com" };
    (authApi.verifyRegistration as jest.Mock).mockResolvedValue(authResponse);
    renderScreen(<VerifyEmailScreen />);
    fireEvent.changeText(screen.getByLabelText("Código de verificación"), "123456");
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith(authResponse));
    expect(authApi.verifyRegistration).toHaveBeenCalledWith("ana@mail.com", "123456");

    fireEvent.press(screen.getByText("Corregir el email"));
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: "/register",
      params: { email: "ana@mail.com" },
    });
  });
});

describe("LoginCode (US3)", () => {
  it("requests a code and signs in with it", async () => {
    (authApi.requestLoginCode as jest.Mock).mockResolvedValue(undefined);
    (authApi.verifyLoginCode as jest.Mock).mockResolvedValue(authResponse);
    renderScreen(<CodeSignInScreen kind="login-code" />);
    fireEvent.changeText(screen.getByLabelText("Email"), "ana@mail.com");
    fireEvent.press(screen.getByText("Enviarme un código"));
    fireEvent.changeText(await screen.findByLabelText("Código de acceso"), "654321");
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith(authResponse));
    expect(authApi.verifyLoginCode).toHaveBeenCalledWith("ana@mail.com", "654321");
  });
});

describe("ForgotPassword (US4)", () => {
  it("sets the new password with the code", async () => {
    (authApi.requestPasswordReset as jest.Mock).mockResolvedValue(undefined);
    (authApi.confirmPasswordReset as jest.Mock).mockResolvedValue(authResponse);
    renderScreen(<CodeSignInScreen kind="password-reset" />);
    fireEvent.changeText(screen.getByLabelText("Email"), "ana@mail.com");
    fireEvent.press(screen.getByText("Enviarme un código"));
    fireEvent.changeText(await screen.findByLabelText("Código"), "111222");
    fireEvent.changeText(screen.getByLabelText("Contraseña nueva"), "brand-new-pass");
    fireEvent.press(screen.getByText("Guardar y entrar"));
    await waitFor(() =>
      expect(authApi.confirmPasswordReset).toHaveBeenCalledWith(
        "ana@mail.com",
        "111222",
        "brand-new-pass",
      ),
    );
    expect(mockSignIn).toHaveBeenCalledWith(authResponse);
  });
});
