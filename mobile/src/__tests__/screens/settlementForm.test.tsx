import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import AccountBalancesScreen from "@/screens/balances/AccountBalancesScreen";
import SettlementFormScreen from "@/screens/balances/SettlementFormScreen";
import { accountsApi } from "@/services/api/accounts";
import { settlementsApi } from "@/services/api/settlements";
import { ApiError } from "@/services/api/types";

import { makeAccount, makeBalances, makeSettlement } from "../support/accounts";
import { renderScreen } from "../support/render";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({ accountId: "acc1" }),
    useFocusEffect: (callback: () => void) => useEffect(callback, [callback]),
  };
});
jest.mock("@react-native-community/datetimepicker", () => () => null);
jest.mock("@/services/api/accounts", () => ({ accountsApi: { get: jest.fn() } }));
jest.mock("@/services/api/settlements", () => ({
  settlementsApi: { balances: jest.fn(), list: jest.fn(), create: jest.fn(), remove: jest.fn() },
}));
jest.mock("@/utils/expenseGroups", () => ({
  ...jest.requireActual("@/utils/expenseGroups"),
  today: () => "2026-11-11",
}));

const api = settlementsApi as jest.Mocked<typeof settlementsApi>;
const threePeople = makeAccount({
  participants: [
    { id: "p-ana", name: "Ana", isLinked: true, isMe: true, isOwner: true },
    { id: "p-leandro", name: "Leandro", isLinked: false, isMe: false, isOwner: false },
    { id: "p-javier", name: "Javier", isLinked: false, isMe: false, isOwner: false },
  ],
});

beforeEach(async () => {
  jest.clearAllMocks();
  (accountsApi.get as jest.Mock).mockResolvedValue(threePeople);
  await i18n.changeLanguage("es");
});

async function fill(from: string | null, to: string | null, amount: string) {
  await screen.findByText("Nuevo reembolso");
  if (from) fireEvent.press(screen.getByLabelText(`Pagó: ${from}`));
  if (to) fireEvent.press(screen.getByLabelText(`Recibió: ${to}`));
  fireEvent.changeText(screen.getByLabelText("Importe (ARS)"), amount);
}

describe("manual settlement (US3)", () => {
  it("starts empty with today's date and sends a manual settlement", async () => {
    api.create.mockResolvedValue(makeSettlement());
    renderScreen(<SettlementFormScreen />);
    await screen.findByText("Nuevo reembolso");
    expect(screen.getByLabelText("Importe (ARS)").props.value).toBe("");
    expect(screen.getByText(/11 nov 2026/)).toBeOnTheScreen();
    await fill("Javier", "Ana", "10,5");
    fireEvent.press(screen.getByText("Guardar reembolso"));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(api.create).toHaveBeenCalledWith(
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
  });

  it.each([
    ["Ana", "Ana", "10", "Quien paga y quien recibe tienen que ser distintos."],
    [null, "Ana", "10", "Elegí quién pagó."],
    ["Ana", null, "10", "Elegí quién recibió."],
    ["Javier", "Ana", "0", "El importe tiene que ser mayor a cero."],
    ["Javier", "Ana", "10,555", "Esta moneda admite como máximo 2 decimales."],
  ])("rejects %s → %s %s", async (from, to, amount, message) => {
    renderScreen(<SettlementFormScreen />);
    await fill(from, to, amount);
    fireEvent.press(screen.getByText("Guardar reembolso"));
    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("does not accept decimals in a currency without them", async () => {
    (accountsApi.get as jest.Mock).mockResolvedValue({
      ...threePeople,
      currency: "JPY",
      currencyDecimals: 0,
    });
    renderScreen(<SettlementFormScreen />);
    await screen.findByText("Nuevo reembolso");
    fireEvent.press(screen.getByLabelText("Pagó: Javier"));
    fireEvent.press(screen.getByLabelText("Recibió: Ana"));
    fireEvent.changeText(screen.getByLabelText("Importe (JPY)"), "10,5");
    fireEvent.press(screen.getByText("Guardar reembolso"));
    expect(await screen.findByText(/como máximo 0 decimales/)).toBeOnTheScreen();
  });

  it("keeps the request id when retrying after an error", async () => {
    api.create
      .mockRejectedValueOnce(new ApiError(0, "network_error"))
      .mockResolvedValueOnce(makeSettlement());
    renderScreen(<SettlementFormScreen />);
    await fill("Javier", "Ana", "10");
    fireEvent.press(screen.getByText("Guardar reembolso"));
    await screen.findByText(/No pudimos conectarnos/);
    fireEvent.press(screen.getByText("Guardar reembolso"));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(api.create.mock.calls[0][2]).toBe(api.create.mock.calls[1][2]);
  });
});

describe("balances screen entry point", () => {
  beforeEach(() => {
    api.balances.mockResolvedValue(makeBalances());
    api.list.mockResolvedValue({
      items: [
        makeSettlement(),
        makeSettlement({ id: "s2", from: { id: "p-diego", name: "Diego" }, isExcluded: true }),
      ],
      nextCursor: "c1",
    });
  });

  it("opens the manual form and lists the settlements", async () => {
    renderScreen(<AccountBalancesScreen />);
    fireEvent.press(await screen.findByText("Registrar reembolso"));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/accounts/[accountId]/settlements/new",
      params: { accountId: "acc1" },
    });
    expect(screen.getByText("Leandro le pagó a Ana")).toBeOnTheScreen();
    expect(screen.getByText("Participante quitado")).toBeOnTheScreen();
  });

  it("loads more settlements", async () => {
    api.list.mockResolvedValueOnce({ items: [makeSettlement()], nextCursor: "c1" });
    api.list.mockResolvedValueOnce({ items: [makeSettlement({ id: "s3" })], nextCursor: null });
    renderScreen(<AccountBalancesScreen />);
    fireEvent.press(await screen.findByText("Cargar más"));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith("acc1", "c1"));
    expect(await screen.findByTestId("settlement-s3")).toBeOnTheScreen();
    expect(screen.queryByText("Cargar más")).toBeNull();
  });

  it("a closed account offers neither registering nor marking as paid", async () => {
    (accountsApi.get as jest.Mock).mockResolvedValue(makeAccount({ isClosed: true }));
    renderScreen(<AccountBalancesScreen />);
    await screen.findByTestId("balance-me");
    expect(screen.queryByText("Registrar reembolso")).toBeNull();
    expect(screen.queryByText("Marcar como pagado")).toBeNull();
    expect(screen.getByText("Leandro → Ana")).toBeOnTheScreen();
  });
});
