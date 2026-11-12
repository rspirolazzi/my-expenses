import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { registerAction } from "@/app/actions/auth";
import { RegisterForm } from "@/components/RegisterForm";

import { router } from "../support/mocks";
import { renderWithIntl } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("@/app/actions/auth", () => ({ registerAction: jest.fn() }));

const registerMock = registerAction as jest.Mock;

async function fill(email: string, password: string) {
  await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("Contraseña"), password);
  await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
}

beforeEach(() => {
  registerMock.mockReset();
  router.push.mockReset();
  window.sessionStorage.clear();
});

it("rejects a password shorter than 8 characters before calling the API", async () => {
  renderWithIntl(<RegisterForm />);
  await fill("ana@mail.com", "1234567");
  expect(screen.getByRole("alert")).toHaveTextContent("al menos 8 caracteres");
  expect(registerMock).not.toHaveBeenCalled();
});

it("rejects a password equal to the email", async () => {
  renderWithIntl(<RegisterForm />);
  await fill("ana@mail.com", "ana@mail.com");
  expect(screen.getByRole("alert")).toHaveTextContent("no puede ser igual al email");
});

it("shows the translated API error", async () => {
  registerMock.mockResolvedValue({ ok: false, code: "rate_limited" });
  renderWithIntl(<RegisterForm />);
  await fill("ana@mail.com", "secret-123");
  expect(await screen.findByRole("alert")).toHaveTextContent("Demasiados pedidos");
});

it("goes to the verification step without putting the email in the URL", async () => {
  registerMock.mockResolvedValue({ ok: true });
  renderWithIntl(<RegisterForm />);
  await fill("ana@mail.com", "secret-123");
  expect(registerMock).toHaveBeenCalledWith(
    expect.objectContaining({ email: "ana@mail.com", password: "secret-123" }),
  );
  expect(router.push).toHaveBeenCalledWith("/verify-email");
  expect(window.sessionStorage.getItem("chepagame.pendingEmail")).toBe("ana@mail.com");
});
