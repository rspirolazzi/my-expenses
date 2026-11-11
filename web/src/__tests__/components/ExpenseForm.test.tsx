import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";

import { createExpenseAction } from "@/app/actions/expenses";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { today } from "@/lib/expenseGroups";

import { makeAccount, makeExpense } from "../support/accounts";
import { router } from "../support/mocks";
import { messages, renderWithIntl } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("@/app/actions/expenses", () => ({
  createExpenseAction: jest.fn(),
  updateExpenseAction: jest.fn(),
}));

const create = createExpenseAction as jest.Mock;

beforeEach(() => {
  create.mockReset();
  router.push.mockReset();
});

it("comes with today, my participant as payer and everyone sharing", () => {
  renderWithIntl(<ExpenseForm account={makeAccount()} />);
  expect(screen.getByLabelText("Fecha")).toHaveValue(today());
  expect(screen.getByLabelText("Pagó")).toHaveValue("p-ana");
  for (const name of ["Ana", "Leandro", "Javier"]) {
    expect(screen.getByRole("checkbox", { name })).toBeChecked();
  }
  expect(screen.getByLabelText("Importe (ARS)")).toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: /moneda/i })).not.toBeInTheDocument();
});

it("computes today only after hydration, so the server HTML has no date", () => {
  const html = renderToString(
    <NextIntlClientProvider locale="es" messages={messages.es} timeZone="UTC">
      <ExpenseForm account={makeAccount()} />
    </NextIntlClientProvider>,
  );
  expect(html).toMatch(/id="expense-date"[^>]*value=""/);
});

it("validates before sending", async () => {
  renderWithIntl(<ExpenseForm account={makeAccount()} />);
  const save = screen.getByRole("button", { name: "Guardar gasto" });

  await userEvent.click(save);
  expect(screen.getByRole("alert")).toHaveTextContent("Ingresá un concepto");

  await userEvent.type(screen.getByLabelText("Concepto"), "Cena");
  await userEvent.type(screen.getByLabelText("Importe (ARS)"), "10,555");
  await userEvent.click(save);
  expect(screen.getByRole("alert")).toHaveTextContent("como máximo 2 decimales");

  await userEvent.clear(screen.getByLabelText("Importe (ARS)"));
  await userEvent.type(screen.getByLabelText("Importe (ARS)"), "100");
  for (const name of ["Ana", "Leandro", "Javier"]) {
    await userEvent.click(screen.getByRole("checkbox", { name }));
  }
  await userEvent.click(save);
  expect(screen.getByRole("alert")).toHaveTextContent("al menos un participante");
  expect(create).not.toHaveBeenCalled();
});

it("does not accept decimals for a currency without them", async () => {
  renderWithIntl(<ExpenseForm account={makeAccount({ currency: "JPY", currencyDecimals: 0 })} />);
  await userEvent.type(screen.getByLabelText("Concepto"), "Ramen");
  await userEvent.type(screen.getByLabelText("Importe (JPY)"), "10,5");
  await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));
  expect(screen.getByRole("alert")).toHaveTextContent("ningún decimal");
});

it("sends decimal text and keeps the same clientRequestId when retrying", async () => {
  create
    .mockResolvedValueOnce({ ok: false, code: "network_error" })
    .mockResolvedValueOnce({ ok: true, data: makeExpense({ id: "new1" }) });
  renderWithIntl(<ExpenseForm account={makeAccount()} />);
  await userEvent.type(screen.getByLabelText("Concepto"), "Cena");
  await userEvent.type(screen.getByLabelText("Importe (ARS)"), "1.234,5");
  await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));
  await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));

  const [first, second] = create.mock.calls;
  expect(first[1]).toMatchObject({
    title: "Cena",
    amount: "1234.50",
    paidById: "p-ana",
    participantIds: ["p-ana", "p-leandro", "p-javier"],
    categoryIcon: "other",
    date: today(),
  });
  expect(first[2]).toBe(second[2]);
  expect(router.push).toHaveBeenCalledWith("/accounts/acc1/expenses/new1");
});

it("shows translated API errors", async () => {
  create.mockResolvedValue({ ok: false, code: "invalid_participant" });
  renderWithIntl(<ExpenseForm account={makeAccount()} />);
  await userEvent.type(screen.getByLabelText("Concepto"), "Cena");
  await userEvent.type(screen.getByLabelText("Importe (ARS)"), "10");
  await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));
  expect(screen.getByRole("alert")).toHaveTextContent("participantes activos");
});
