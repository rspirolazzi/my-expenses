import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { registerAction } from "@/app/actions/auth";
import { updateMeAction } from "@/app/actions/profile";
import { OnboardingCurrencyForm } from "@/components/OnboardingCurrencyForm";
import { RegisterForm } from "@/components/RegisterForm";
import { savePendingRedirect, takePendingRedirect, withCallback } from "@/lib/pendingRedirect";

import { router } from "../support/mocks";
import { renderWithIntl, userResponse } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("@/app/actions/auth", () => ({ registerAction: jest.fn() }));
jest.mock("@/app/actions/profile", () => ({ updateMeAction: jest.fn() }));

beforeEach(() => {
  window.sessionStorage.clear();
  router.push.mockReset();
  router.replace.mockReset();
});

describe("pendingRedirect", () => {
  it("returns the saved internal path once", () => {
    savePendingRedirect("/invite/abc");
    expect(takePendingRedirect("/dashboard")).toBe("/invite/abc");
    expect(takePendingRedirect("/dashboard")).toBe("/dashboard");
  });

  it("ignores external destinations", () => {
    savePendingRedirect("https://evil.example");
    savePendingRedirect("//evil.example");
    expect(takePendingRedirect("/dashboard")).toBe("/dashboard");
  });

  it("keeps the callback in links", () => {
    expect(withCallback("/register", "/invite/abc")).toBe("/register?callbackUrl=%2Finvite%2Fabc");
    expect(withCallback("/register", undefined)).toBe("/register");
  });
});

it("a sign-up started from an invitation ends, after the currency step, on that invitation", async () => {
  (registerAction as jest.Mock).mockResolvedValue({ ok: true });
  (updateMeAction as jest.Mock).mockResolvedValue({ ok: true, data: userResponse });

  const { unmount } = renderWithIntl(<RegisterForm callbackUrl="/invite/abc" />);
  await userEvent.type(screen.getByLabelText("Email"), "ana@mail.com");
  await userEvent.type(screen.getByLabelText("Contraseña"), "secret-123");
  await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
  expect(router.push).toHaveBeenCalledWith("/verify-email");
  unmount();

  // (email verification happens in between and always leads to the currency step)
  renderWithIntl(<OnboardingCurrencyForm languages={["es-AR"]} />);
  await waitFor(() => expect(screen.getByLabelText("Moneda por defecto")).toHaveValue("ARS"));
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
  expect(router.replace).toHaveBeenCalledWith("/invite/abc");
});
