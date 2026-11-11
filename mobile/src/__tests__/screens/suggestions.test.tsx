import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { SuggestionList } from "@/components/balances/SuggestionList";
import i18n from "@/i18n";
import { settlementsApi } from "@/services/api/settlements";
import { ApiError } from "@/services/api/types";

import { makeAccount, makeBalances, makeSettlement } from "../support/accounts";
import { renderScreen } from "../support/render";

jest.mock("@/services/api/settlements", () => ({
  settlementsApi: { create: jest.fn() },
}));
jest.mock("@/utils/expenseGroups", () => ({
  ...jest.requireActual("@/utils/expenseGroups"),
  today: () => "2026-11-11",
}));

const create = settlementsApi.create as jest.Mock;
const { suggestions } = makeBalances();
const onSaved = jest.fn();

function renderList(account = makeAccount()) {
  return renderScreen(
    <SuggestionList account={account} suggestions={suggestions} locale="es" onSaved={onSaved} />,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage("es");
});

it("shows who pays whom and how much", () => {
  renderList();
  expect(screen.getByText("Leandro → Ana")).toBeOnTheScreen();
  expect(screen.getByText("Javier → Ana")).toBeOnTheScreen();
  expect(screen.getAllByText(/30,00 ARS/)).toHaveLength(2);
});

it("says there is nothing pending", () => {
  renderScreen(
    <SuggestionList account={makeAccount()} suggestions={[]} locale="es" onSaved={onSaved} />,
  );
  expect(screen.getByText("No hay nada pendiente.")).toBeOnTheScreen();
});

it("marks as paid after confirming fixed data, retrying with the same request id", async () => {
  create
    .mockRejectedValueOnce(new ApiError(0, "network_error"))
    .mockResolvedValueOnce(makeSettlement());
  renderList();
  fireEvent.press(screen.getAllByText("Marcar como pagado")[0]);
  expect(
    await screen.findByText(/Leandro le pagó 30,00 ARS a Ana el 11 de noviembre de 2026/),
  ).toBeOnTheScreen();
  fireEvent.press(screen.getByText("Confirmar"));
  expect(await screen.findByText(/No pudimos conectarnos/)).toBeOnTheScreen();
  fireEvent.press(screen.getByText("Confirmar"));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());

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
});

it("cancel sends nothing", async () => {
  renderList();
  fireEvent.press(screen.getAllByText("Marcar como pagado")[1]);
  fireEvent.press(await screen.findByText("Cancelar"));
  expect(create).not.toHaveBeenCalled();
});

it("closed accounts do not offer the action", () => {
  renderList(makeAccount({ isClosed: true }));
  expect(screen.queryByText("Marcar como pagado")).toBeNull();
});

it.each([
  ["account_closed", /La Cuenta está cerrada/],
  ["invalid_participant", /participantes activos/],
] as const)("translates %s", async (code, text) => {
  create.mockRejectedValue(new ApiError(code === "account_closed" ? 409 : 422, code));
  renderList();
  fireEvent.press(screen.getAllByText("Marcar como pagado")[0]);
  fireEvent.press(await screen.findByText("Confirmar"));
  expect(await screen.findByText(text)).toBeOnTheScreen();
});
