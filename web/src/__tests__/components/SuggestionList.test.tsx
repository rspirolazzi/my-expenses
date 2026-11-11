import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createSettlementAction } from "@/app/actions/settlements";
import { SuggestionList } from "@/components/balances/SuggestionList";

import { makeAccount, makeBalances, makeSettlement } from "../support/accounts";
import { router } from "../support/mocks";
import { renderWithIntl } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("@/app/actions/settlements", () => ({ createSettlementAction: jest.fn() }));
jest.mock("@/lib/expenseGroups", () => ({
  ...jest.requireActual("@/lib/expenseGroups"),
  today: () => "2026-11-11",
}));

const create = createSettlementAction as jest.Mock;
const { suggestions } = makeBalances();

beforeEach(() => jest.clearAllMocks());

it("shows who pays whom and how much", () => {
  renderWithIntl(<SuggestionList account={makeAccount()} suggestions={suggestions} />);
  const rows = screen.getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  expect(within(rows[0]).getByText("Leandro → Ana")).toBeInTheDocument();
  expect(within(rows[0]).getByText(/30,00 ARS/)).toBeInTheDocument();
});

it("says there is nothing pending", () => {
  renderWithIntl(<SuggestionList account={makeAccount()} suggestions={[]} />);
  expect(screen.getByText("No hay nada pendiente.")).toBeInTheDocument();
});

it("marks as paid after confirming fixed data, with a stable request id", async () => {
  create
    .mockResolvedValueOnce({ ok: false, code: "network_error" })
    .mockResolvedValueOnce({ ok: true, data: makeSettlement() });
  renderWithIntl(<SuggestionList account={makeAccount()} suggestions={suggestions} />);
  await userEvent.click(screen.getAllByRole("button", { name: "Marcar como pagado" })[0]);
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText(/Leandro le pagó 30,00 ARS a Ana el/)).toBeInTheDocument();
  expect(within(dialog).getByText(/11 de noviembre de 2026/)).toBeInTheDocument();
  expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();

  await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  await userEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar" }),
  );

  expect(create).toHaveBeenCalledTimes(2);
  const [accountId, input, requestId] = create.mock.calls[0];
  expect(accountId).toBe("acc1");
  expect(input).toEqual({
    fromParticipantId: "p-leandro",
    toParticipantId: "p-ana",
    amount: "30.00",
    date: "2026-11-11",
    source: "suggestion",
  });
  expect(create.mock.calls[1][2]).toBe(requestId);
  expect(router.refresh).toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("cancel sends nothing", async () => {
  renderWithIntl(<SuggestionList account={makeAccount()} suggestions={suggestions} />);
  await userEvent.click(screen.getAllByRole("button", { name: "Marcar como pagado" })[1]);
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(create).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("closed accounts do not offer the action", () => {
  renderWithIntl(
    <SuggestionList account={makeAccount({ isClosed: true })} suggestions={suggestions} />,
  );
  expect(screen.queryByRole("button", { name: "Marcar como pagado" })).not.toBeInTheDocument();
});

it.each([
  ["account_closed", "La Cuenta está cerrada"],
  ["invalid_participant", "participantes activos"],
])("translates %s", async (code, text) => {
  create.mockResolvedValue({ ok: false, code });
  renderWithIntl(<SuggestionList account={makeAccount()} suggestions={suggestions} />);
  await userEvent.click(screen.getAllByRole("button", { name: "Marcar como pagado" })[0]);
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  const alert = screen.getByRole("alert");
  expect(alert).not.toHaveTextContent("error inesperado");
  expect(alert).toHaveTextContent(text);
});
