import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { RefreshControl } from "react-native";

import i18n from "@/i18n";
import AccountBalancesScreen from "@/screens/balances/AccountBalancesScreen";
import { accountsApi } from "@/services/api/accounts";
import { settlementsApi } from "@/services/api/settlements";
import { ApiError } from "@/services/api/types";

import { makeAccount, makeBalances, makeSettlement } from "../support/accounts";
import { renderScreen } from "../support/render";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockFocus: { run?: () => void } = {};

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({ accountId: "acc1" }),
    useFocusEffect: (callback: () => void) => {
      mockFocus.run = callback;
      useEffect(callback, [callback]);
    },
  };
});
jest.mock("@/services/api/accounts", () => ({ accountsApi: { get: jest.fn() } }));
jest.mock("@/services/api/settlements", () => ({
  settlementsApi: { balances: jest.fn(), list: jest.fn(), create: jest.fn(), remove: jest.fn() },
}));

const api = settlementsApi as jest.Mocked<typeof settlementsApi>;

beforeEach(async () => {
  jest.clearAllMocks();
  (accountsApi.get as jest.Mock).mockResolvedValue(makeAccount());
  api.balances.mockResolvedValue(makeBalances());
  api.list.mockResolvedValue({ items: [makeSettlement()], nextCursor: null });
  await i18n.changeLanguage("es");
});

describe("balances (US1)", () => {
  it("shows each balance with mine highlighted in plain words", async () => {
    renderScreen(<AccountBalancesScreen />);
    const mine = await screen.findByTestId("balance-me");
    expect(within(mine).getByText("Ana (Vos)")).toBeOnTheScreen();
    expect(within(mine).getByText(/Te deben 60,00 ARS/)).toBeOnTheScreen();
    expect(
      within(screen.getByTestId("balance-p-leandro")).getByText(/Debe 30,00 ARS/),
    ).toBeOnTheScreen();
    // The "Saldos" tab and the section title.
    expect(screen.getAllByText("Saldos")).toHaveLength(2);
  });

  it("tells me I owe, or that everyone is settled up", async () => {
    api.balances.mockResolvedValueOnce(
      makeBalances({
        balances: [
          { participant: { id: "p-ana", name: "Ana" }, amount: "-30.00", isMe: true },
          { participant: { id: "p-leandro", name: "Leandro" }, amount: "30.00", isMe: false },
        ],
      }),
    );
    const { unmount } = renderScreen(<AccountBalancesScreen />);
    expect(await screen.findByText(/Debés 30,00 ARS/)).toBeOnTheScreen();
    expect(screen.getByText(/Le deben 30,00 ARS/)).toBeOnTheScreen();
    unmount();

    api.balances.mockResolvedValueOnce(
      makeBalances({
        balances: [{ participant: { id: "p-ana", name: "Ana" }, amount: "0.00", isMe: true }],
        suggestions: [],
      }),
    );
    renderScreen(<AccountBalancesScreen />);
    expect(await screen.findByText("Estás al día")).toBeOnTheScreen();
    expect(screen.getByText("No hay deudas: todos están al día.")).toBeOnTheScreen();
  });

  it("formats in English", async () => {
    await i18n.changeLanguage("en");
    renderScreen(<AccountBalancesScreen />);
    expect(await screen.findByText(/You are owed ARS\s*60\.00/)).toBeOnTheScreen();
  });

  it("warns about pending expenses and goes to the expenses tab", async () => {
    api.balances.mockResolvedValue(makeBalances({ pendingExpenses: 2 }));
    renderScreen(<AccountBalancesScreen />);
    expect(await screen.findByText("2 gastos pendientes")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Completarlos en Gastos"));
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: "/accounts/[accountId]",
      params: { accountId: "acc1" },
    });
  });

  it("reloads on focus and on pull to refresh, never by itself", async () => {
    const view = renderScreen(<AccountBalancesScreen />);
    await screen.findByTestId("balance-me");
    expect(api.balances).toHaveBeenCalledTimes(1);
    await act(async () => mockFocus.run?.());
    expect(api.balances).toHaveBeenCalledTimes(2);
    const refresh = view.UNSAFE_getByType(RefreshControl);
    await act(async () => refresh.props.onRefresh());
    expect(api.balances).toHaveBeenCalledTimes(3);
  });

  it("goes back to the accounts list for a missing account", async () => {
    api.balances.mockRejectedValue(new ApiError(404, "not_found"));
    renderScreen(<AccountBalancesScreen />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/accounts"));
  });
});
