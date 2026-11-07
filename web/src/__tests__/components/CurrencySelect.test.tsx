import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";

import { updateMeAction } from "@/app/actions/profile";
import { CurrencySelect } from "@/components/CurrencySelect";
import { OnboardingCurrencyForm } from "@/components/OnboardingCurrencyForm";

import { router } from "../support/mocks";
import { messages, renderWithIntl, userResponse } from "../support/render";

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

describe("CurrencySelect server render", () => {
  // The currency list comes from ICU data, which differs between the server and the browser, so
  // the server must render only the selected code or hydration fails (and React re-renders the
  // whole page on the client).
  function serverHtml(value: string) {
    return renderToString(
      <NextIntlClientProvider locale="es" messages={messages.es} timeZone="UTC">
        <CurrencySelect id="c" label="Moneda" value={value} onChange={() => {}} />
      </NextIntlClientProvider>,
    );
  }

  it("renders only the selected currency on the server", () => {
    const html = serverHtml("USD");
    expect(html.match(/<option/g)).toHaveLength(2);
    expect(html).toContain('value="USD"');
  });

  it("renders only the placeholder when nothing is selected", () => {
    expect(serverHtml("").match(/<option/g)).toHaveLength(1);
  });

  it("shows the full localized list once hydrated", () => {
    renderWithIntl(<CurrencySelect id="c" label="Moneda" value="USD" onChange={() => {}} />);
    const select = screen.getByLabelText("Moneda") as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThan(10);
    expect(select).toHaveValue("USD");
  });
});
