import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import AccountDetailScreen from "@/screens/accounts/AccountDetailScreen";
import { accountsApi } from "@/services/api/accounts";

import { makeAccount, memberView } from "../support/accounts";
import { renderScreen } from "../support/render";

const mockRouter = { push: jest.fn(), replace: jest.fn() };

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ accountId: "acc1" }),
}));
jest.mock("@/services/api/accounts", () => ({
  accountsApi: { get: jest.fn(), close: jest.fn(), remove: jest.fn() },
}));

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage("es");
});

it("the owner closes the account after a final-warning dialog", async () => {
  (accountsApi.get as jest.Mock).mockResolvedValue(makeAccount());
  (accountsApi.close as jest.Mock).mockResolvedValue(makeAccount({ isClosed: true }));
  renderScreen(<AccountDetailScreen />);
  fireEvent.press(await screen.findByText("Cerrar Cuenta"));
  expect(await screen.findByText(/definitivo/)).toBeTruthy();
  fireEvent.press(screen.getByText("Continuar"));
  await waitFor(() => expect(accountsApi.close).toHaveBeenCalledWith("acc1"));
  expect(await screen.findByText("Esta Cuenta está cerrada: es de solo lectura.")).toBeTruthy();
});

it("deleting asks Continuar/Cancelar; Cancelar does nothing", async () => {
  (accountsApi.get as jest.Mock).mockResolvedValue(makeAccount());
  (accountsApi.remove as jest.Mock).mockResolvedValue(undefined);
  renderScreen(<AccountDetailScreen />);
  fireEvent.press(await screen.findByText("Dar de baja la Cuenta"));
  expect(await screen.findByText(/todos sus gastos/)).toBeTruthy();
  fireEvent.press(screen.getByText("Cancelar"));
  expect(accountsApi.remove).not.toHaveBeenCalled();
  // Wait for the dialog's closing animation before opening it again.
  await waitFor(() => expect(screen.queryByText("Continuar")).toBeNull());
  fireEvent.press(screen.getByText("Dar de baja la Cuenta"));
  fireEvent.press(await screen.findByText("Continuar"));
  await waitFor(() => expect(accountsApi.remove).toHaveBeenCalledWith("acc1"));
  expect(mockRouter.replace).toHaveBeenCalledWith("/accounts");
});

it("a closed account is read-only, but the owner can still delete it", async () => {
  (accountsApi.get as jest.Mock).mockResolvedValue(makeAccount({ isClosed: true }));
  renderScreen(<AccountDetailScreen />);
  expect(await screen.findByText("Esta Cuenta está cerrada: es de solo lectura.")).toBeTruthy();
  expect(screen.queryByText("Quitar")).toBeNull();
  expect(screen.queryByText("Compartir")).toBeNull();
  expect(screen.queryByText("Cerrar Cuenta")).toBeNull();
  expect(screen.getByText("Dar de baja la Cuenta")).toBeTruthy();
});

it("members do not see close or delete", async () => {
  (accountsApi.get as jest.Mock).mockResolvedValue(memberView());
  renderScreen(<AccountDetailScreen />);
  await screen.findByText("Salir de la Cuenta");
  expect(screen.queryByText("Cerrar Cuenta")).toBeNull();
  expect(screen.queryByText("Dar de baja la Cuenta")).toBeNull();
});
