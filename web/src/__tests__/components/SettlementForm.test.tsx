import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createSettlementAction } from "@/app/actions/settlements";
import { SettlementForm } from "@/components/balances/SettlementForm";

import { makeAccount, makeSettlement } from "../support/accounts";
import { router } from "../support/mocks";
import { renderWithIntl } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("@/app/actions/settlements", () => ({ createSettlementAction: jest.fn() }));
jest.mock("@/lib/expenseGroups", () => ({
  ...jest.requireActual("@/lib/expenseGroups"),
  today: () => "2026-11-11",
}));

const create = createSettlementAction as jest.Mock;

beforeEach(() => jest.clearAllMocks());

async function fill(from: string, to: string, amount: string) {
  if (from) await userEvent.selectOptions(screen.getByLabelText("Pagó"), from);
  if (to) await userEvent.selectOptions(screen.getByLabelText("Recibió"), to);
  if (amount) await userEvent.type(screen.getByLabelText("Importe (ARS)"), amount);
}

it("starts empty with active participants and today's date", () => {
  renderWithIntl(<SettlementForm account={makeAccount()} />);
  expect(screen.getByLabelText("Pagó")).toHaveValue("");
  expect(screen.getByLabelText("Recibió")).toHaveValue("");
  expect(screen.getByLabelText("Importe (ARS)")).toHaveValue("");
  expect(screen.getByLabelText("Fecha")).toHaveValue("2026-11-11");
  const options = screen.getAllByRole("option").map((o) => o.textContent);
  expect(options.filter((o) => o === "Leandro")).toHaveLength(2);
});

it("sends a manual settlement and goes back to the balances", async () => {
  create.mockResolvedValue({ ok: true, data: makeSettlement() });
  renderWithIntl(<SettlementForm account={makeAccount()} />);
  await fill("Javier", "Ana", "10,5");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reembolso" }));
  expect(create).toHaveBeenCalledWith(
    "acc1",
    {
      fromParticipantId: "p-javier",
      toParticipantId: "p-ana",
      amount: "10.50",
      date: "2026-11-11",
      source: "manual",
    },
    expect.any(String),
  );
  expect(router.push).toHaveBeenCalledWith("/accounts/acc1/balances");
});

it.each([
  ["Ana", "Ana", "10", "Quien paga y quien recibe tienen que ser distintos."],
  ["", "Ana", "10", "Elegí quién pagó."],
  ["Ana", "", "10", "Elegí quién recibió."],
  ["Javier", "Ana", "0", "El importe tiene que ser mayor a cero."],
  ["Javier", "Ana", "10,555", "Esta moneda admite como máximo 2 decimales."],
])("rejects %s → %s %s", async (from, to, amount, message) => {
  renderWithIntl(<SettlementForm account={makeAccount()} />);
  await fill(from, to, amount);
  await userEvent.click(screen.getByRole("button", { name: "Guardar reembolso" }));
  expect(screen.getByRole("alert")).toHaveTextContent(message);
  expect(create).not.toHaveBeenCalled();
});

it("does not accept decimals in a currency without them", async () => {
  renderWithIntl(
    <SettlementForm account={makeAccount({ currency: "JPY", currencyDecimals: 0 })} />,
  );
  await userEvent.selectOptions(screen.getByLabelText("Pagó"), "Javier");
  await userEvent.selectOptions(screen.getByLabelText("Recibió"), "Ana");
  await userEvent.type(screen.getByLabelText("Importe (JPY)"), "10,5");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reembolso" }));
  expect(screen.getByRole("alert")).toHaveTextContent("ningún decimal");
});

it("keeps the request id when retrying after an error", async () => {
  create
    .mockResolvedValueOnce({ ok: false, code: "network_error" })
    .mockResolvedValueOnce({ ok: true, data: makeSettlement() });
  renderWithIntl(<SettlementForm account={makeAccount()} />);
  await fill("Javier", "Ana", "10");
  const save = screen.getByRole("button", { name: "Guardar reembolso" });
  await userEvent.click(save);
  await userEvent.click(save);
  expect(create.mock.calls[0][2]).toBe(create.mock.calls[1][2]);
});
