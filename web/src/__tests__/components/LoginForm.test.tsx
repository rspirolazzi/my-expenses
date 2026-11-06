import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { credentialsSignInAction } from "@/app/actions/auth";
import { LoginForm } from "@/components/LoginForm";

import { router } from "../support/mocks";
import { renderWithIntl } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("@/app/actions/auth", () => ({ credentialsSignInAction: jest.fn() }));

const signInMock = credentialsSignInAction as jest.Mock;

async function submit(password = "correct-password") {
  await userEvent.type(screen.getByLabelText("Email"), "ana@mail.com");
  await userEvent.type(screen.getByLabelText("Contraseña"), password);
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

beforeEach(() => {
  signInMock.mockReset();
  router.replace.mockReset();
});

it("signs in with email and password and goes to the callback URL", async () => {
  signInMock.mockResolvedValue({ ok: true });
  renderWithIntl(<LoginForm callbackUrl="/profile" />);
  await submit();
  expect(signInMock).toHaveBeenCalledWith({
    mode: "password",
    email: "ana@mail.com",
    password: "correct-password",
  });
  expect(router.replace).toHaveBeenCalledWith("/profile");
});

it("ignores external callback URLs", async () => {
  signInMock.mockResolvedValue({ ok: true });
  renderWithIntl(<LoginForm callbackUrl="//evil.example" />);
  await submit();
  expect(router.replace).toHaveBeenCalledWith("/dashboard");
});

it("shows the generic message for invalid credentials", async () => {
  signInMock.mockResolvedValue({ ok: false, code: "invalid_credentials" });
  renderWithIntl(<LoginForm />);
  await submit("wrong");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "El email o la contraseña no son correctos.",
  );
});

it("shows the remaining minutes when locked and offers the code login", async () => {
  signInMock.mockResolvedValue({
    ok: false,
    code: "password_login_locked",
    retryAfterSeconds: 600,
  });
  renderWithIntl(<LoginForm />);
  await submit("wrong");
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("10 minutos");
  expect(alert.querySelector('a[href="/login-code"]')).not.toBeNull();
});
