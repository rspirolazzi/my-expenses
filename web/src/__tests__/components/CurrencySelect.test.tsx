import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { updateMeAction } from "@/app/actions/profile";
import { OnboardingCurrencyForm } from "@/components/OnboardingCurrencyForm";

import { router } from "../support/mocks";
import { renderWithIntl, userResponse } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("@/app/actions/profile", () => ({ updateMeAction: jest.fn() }));

const updateMock = updateMeAction as jest.Mock;

beforeEach(() => {
  updateMock.mockReset();
  router.replace.mockReset();
});

it("preselects the currency suggested by the region", async () => {
  renderWithIntl(<OnboardingCurrencyForm languages={["es-AR"]} />);
  await waitFor(() => expect(screen.getByLabelText("Moneda por defecto")).toHaveValue("ARS"));
  expect(screen.getByText("Sugerida según tu región")).toBeInTheDocument();
});

it("preselects nothing when the region is unknown and blocks Continue", async () => {
  renderWithIntl(<OnboardingCurrencyForm languages={["xx"]} />);
  expect(screen.getByLabelText("Moneda por defecto")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await userEvent.selectOptions(screen.getByLabelText("Moneda por defecto"), "EUR");
  expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
});

it("saves the currency and goes to the dashboard", async () => {
  updateMock.mockResolvedValue({ ok: true, data: userResponse });
  renderWithIntl(<OnboardingCurrencyForm languages={["pt-BR"]} />);
  await waitFor(() => expect(screen.getByLabelText("Moneda por defecto")).toHaveValue("BRL"));
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
  expect(updateMock).toHaveBeenCalledWith({ preferences: { defaultCurrency: "BRL" } });
  expect(router.replace).toHaveBeenCalledWith("/dashboard");
});
