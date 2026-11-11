import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";

import { SettlementList } from "@/components/balances/SettlementList";
import i18n from "@/i18n";
import { settlementsApi } from "@/services/api/settlements";
import { ApiError } from "@/services/api/types";

import { makeAccount, makeSettlement } from "../support/accounts";
import { renderScreen } from "../support/render";

jest.mock("@/services/api/settlements", () => ({ settlementsApi: { remove: jest.fn() } }));

const remove = settlementsApi.remove as jest.Mock;
const onChanged = jest.fn();
const items = [makeSettlement({ id: "s1" }), makeSettlement({ id: "s2", amount: "5.00" })];

function renderList(account = makeAccount()) {
  return renderScreen(
    <SettlementList
      account={account}
      items={items}
      locale="es"
      hasMore={false}
      loadingMore={false}
      onLoadMore={jest.fn()}
      onChanged={onChanged}
    />,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage("es");
});

it("asks with Continuar/Cancelar and only Continuar deletes (US4)", async () => {
  remove.mockResolvedValue(undefined);
  renderList();
  fireEvent.press(within(screen.getByTestId("settlement-s1")).getByText("Eliminar"));
  expect(await screen.findByText("¿Eliminar este reembolso?")).toBeOnTheScreen();
  fireEvent.press(screen.getByText("Cancelar"));
  expect(remove).not.toHaveBeenCalled();
  // Wait for the dialog's closing animation before opening it again.
  await waitFor(() => expect(screen.queryByText("Continuar")).toBeNull());

  fireEvent.press(within(screen.getByTestId("settlement-s1")).getByText("Eliminar"));
  fireEvent.press(await screen.findByText("Continuar"));
  await waitFor(() => expect(remove).toHaveBeenCalledWith("acc1", "s1"));
  expect(onChanged).toHaveBeenCalled();
});

it("tells when another member already deleted it and reloads", async () => {
  remove.mockRejectedValue(new ApiError(404, "not_found"));
  renderList();
  fireEvent.press(within(screen.getByTestId("settlement-s2")).getByText("Eliminar"));
  fireEvent.press(await screen.findByText("Continuar"));
  expect(
    await screen.findByText("Este reembolso ya no existe: lo eliminó otro miembro."),
  ).toBeOnTheScreen();
  expect(onChanged).toHaveBeenCalled();
});

it("closed accounts do not offer delete", () => {
  renderList(makeAccount({ isClosed: true }));
  expect(screen.queryByText("Eliminar")).toBeNull();
  expect(screen.getAllByText("Leandro le pagó a Ana")).toHaveLength(2);
});
