import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  credentialsSignInAction,
  requestLoginCodeAction,
  requestPasswordResetAction,
} from "@/app/actions/auth";
import { CodeSignInFlow } from "@/components/CodeSignInFlow";

import { router } from "../support/mocks";
import { renderWithIntl } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("@/app/actions/auth", () => ({
  credentialsSignInAction: jest.fn(),
  requestLoginCodeAction: jest.fn(),
  requestPasswordResetAction: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  router.replace.mockReset();
});

describe("login code (US3)", () => {
  it("asks for the email, then signs in with the code", async () => {
    (requestLoginCodeAction as jest.Mock).mockResolvedValue({ ok: true });
    (credentialsSignInAction as jest.Mock).mockResolvedValue({ ok: true });
    renderWithIntl(<CodeSignInFlow kind="login-code" />);

    await userEvent.type(screen.getByLabelText("Email"), "ana@mail.com");
    await userEvent.click(screen.getByRole("button", { name: "Enviarme un código" }));
    expect(requestLoginCodeAction).toHaveBeenCalledWith("ana@mail.com");

    await userEvent.type(await screen.findByLabelText("Código de acceso"), "123456");
    expect(credentialsSignInAction).toHaveBeenCalledWith({
      mode: "login-code",
      email: "ana@mail.com",
      code: "123456",
      password: undefined,
    });
    expect(router.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("shows invalid_code and lets the user request another code", async () => {
    (requestLoginCodeAction as jest.Mock).mockResolvedValue({ ok: true });
    (credentialsSignInAction as jest.Mock).mockResolvedValue({ ok: false, code: "invalid_code" });
    renderWithIntl(<CodeSignInFlow kind="login-code" />);
    await userEvent.type(screen.getByLabelText("Email"), "ana@mail.com");
    await userEvent.click(screen.getByRole("button", { name: "Enviarme un código" }));
    await userEvent.type(await screen.findByLabelText("Código de acceso"), "000000");
    expect(await screen.findByRole("alert")).toHaveTextContent("Pedí uno nuevo");
    expect(screen.getByRole("button", { name: /Reenviar/ })).toBeInTheDocument();
  });
});

describe("password reset (US4)", () => {
  it("always shows the same message and validates the new password", async () => {
    (requestPasswordResetAction as jest.Mock).mockResolvedValue({ ok: true });
    (credentialsSignInAction as jest.Mock).mockResolvedValue({ ok: true });
    renderWithIntl(<CodeSignInFlow kind="password-reset" />);

    await userEvent.type(screen.getByLabelText("Email"), "ana@mail.com");
    await userEvent.click(screen.getByRole("button", { name: "Enviarme un código" }));
    expect(
      await screen.findByText("Si existe una cuenta con ana@mail.com, te enviamos un código."),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Código"), "123456");
    await userEvent.type(screen.getByLabelText("Contraseña nueva"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Guardar y entrar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("al menos 8 caracteres");
    expect(credentialsSignInAction).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Contraseña nueva"), "-long-enough");
    await userEvent.click(screen.getByRole("button", { name: "Guardar y entrar" }));
    expect(credentialsSignInAction).toHaveBeenCalledWith({
      mode: "password-reset",
      email: "ana@mail.com",
      code: "123456",
      password: "short-long-enough",
    });
  });
});
