import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { ConfirmDialog } from "@/components/accounts/AccountBits";
import { useAuth } from "@/hooks/useAuth";
import i18n from "@/i18n";
import AccountsScreen from "@/screens/accounts/AccountsScreen";
import NewAccountScreen from "@/screens/accounts/NewAccountScreen";
import { accountsApi } from "@/services/api/accounts";

import { makeAccount } from "../support/accounts";
import { renderScreen, user } from "../support/render";

const mockRouter = { push: jest.fn(), replace: jest.fn() };

jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  const { Text } = require("react-native");
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({}),
    useFocusEffect: (callback: () => void) => useEffect(callback, [callback]),
    Link: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});
jest.mock("@/hooks/useAuth", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/api/accounts", () => ({
  accountsApi: { list: jest.fn(), create: jest.fn() },
}));

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage("es");
  (useAuth as jest.Mock).mockReturnValue({
    user: {
      ...user,
      firstName: "Ana",
      preferences: { ...user.preferences, defaultCurrency: "BRL" },
    },
  });
});

describe("Mis Cuentas (US1)", () => {
  it("lists my accounts with a closed badge", async () => {
    (accountsApi.list as jest.Mock).mockResolvedValue([
      {
        id: "a1",
        name: "Viaje",
        icon: "beach",
        currency: "BRL",
        currencyDecimals: 2,
        isClosed: true,
        isOwner: true,
        participantCount: 3,
        updatedAt: "2026-11-06T00:00:00Z",
        myBalance: "0.00",
      },
    ]);
    renderScreen(<AccountsScreen />);
    expect(await screen.findByText("Viaje")).toBeTruthy();
    expect(screen.getByText(/3 participantes/)).toBeTruthy();
    expect(screen.getByText("Cerrada")).toBeTruthy();
  });

  it("shows the empty state", async () => {
    (accountsApi.list as jest.Mock).mockResolvedValue([]);
    renderScreen(<AccountsScreen />);
    expect(await screen.findByText(/Todavía no tenés Cuentas/)).toBeTruthy();
  });
});

describe("Nueva Cuenta (US1)", () => {
  it("prefills currency and my name, validates duplicates and creates", async () => {
    (accountsApi.create as jest.Mock).mockResolvedValue(makeAccount({ id: "new" }));
    renderScreen(<NewAccountScreen />);
    expect(screen.getByLabelText("Tu nombre en esta Cuenta").props.value).toBe("Ana");
    expect(screen.getByText(/^BRL/)).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText("Nombre"), "Viaje");
    fireEvent.changeText(screen.getByLabelText("Nombre 1"), " ana ");
    fireEvent.press(screen.getByText("Crear Cuenta"));
    expect(await screen.findByText(/nombres repetidos/)).toBeTruthy();
    expect(accountsApi.create).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText("Nombre 1"), "Leandro");
    fireEvent.press(screen.getByText("Crear Cuenta"));
    await waitFor(() =>
      expect(accountsApi.create).toHaveBeenCalledWith({
        name: "Viaje",
        description: null,
        icon: "group",
        currency: "BRL",
        myParticipantName: "Ana",
        otherParticipants: ["Leandro"],
      }),
    );
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: "/accounts/[accountId]",
      params: { accountId: "new" },
    });
  });
});

describe("ConfirmDialog", () => {
  it("Cancelar does not confirm; Continuar does", () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    renderScreen(
      <ConfirmDialog
        visible
        title="¿Seguro?"
        message="Texto"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(screen.getByText("Cancelar"));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Continuar"));
    expect(onConfirm).toHaveBeenCalled();
  });
});
