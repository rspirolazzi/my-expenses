import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";

import i18n from "@/i18n";
import AccountDetailScreen from "@/screens/accounts/AccountDetailScreen";
import { accountsApi } from "@/services/api/accounts";
import { expensesApi } from "@/services/api/expenses";

import { makeAccount, memberView } from "../support/accounts";
import { renderScreen } from "../support/render";

const mockRouter = { push: jest.fn(), replace: jest.fn() };

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ accountId: "acc1" }),
}));
jest.mock("@/services/api/accounts", () => ({
  accountsApi: {
    get: jest.fn(),
    update: jest.fn(),
    addParticipant: jest.fn(),
    renameParticipant: jest.fn(),
    removeParticipant: jest.fn(),
    leave: jest.fn(),
    regenerateInviteCode: jest.fn(),
    close: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock("@/services/api/expenses", () => ({
  expensesApi: { participantImpact: jest.fn() },
}));

beforeEach(async () => {
  jest.clearAllMocks();
  (expensesApi.participantImpact as jest.Mock).mockResolvedValue({ affectedExpenses: 0 });
  await i18n.changeLanguage("es");
});

describe("edit (US3)", () => {
  it("renames, adds and removes participants (removal asks for confirmation)", async () => {
    (accountsApi.get as jest.Mock).mockResolvedValue(makeAccount());
    (accountsApi.renameParticipant as jest.Mock).mockResolvedValue(makeAccount());
    (accountsApi.addParticipant as jest.Mock).mockResolvedValue(makeAccount());
    (accountsApi.removeParticipant as jest.Mock).mockResolvedValue(makeAccount());
    renderScreen(<AccountDetailScreen />);
    await screen.findByText("Leandro");

    // The owner's participant has a single "Quitar" (only Leandro's).
    expect(screen.getAllByText("Quitar")).toHaveLength(1);
    fireEvent.press(screen.getByText("Quitar"));
    fireEvent.press(await screen.findByText("Cancelar"));
    expect(accountsApi.removeParticipant).not.toHaveBeenCalled();
    // Wait for the dialog's closing animation before opening it again.
    await waitFor(() => expect(screen.queryByText("Continuar")).toBeNull());
    fireEvent.press(screen.getByText("Quitar"));
    fireEvent.press(await screen.findByText("Continuar"));
    await waitFor(() =>
      expect(accountsApi.removeParticipant).toHaveBeenCalledWith("acc1", "p-leandro"),
    );

    fireEvent.press(screen.getAllByText("Renombrar")[1]);
    fireEvent.changeText(screen.getByLabelText("Renombrar"), "Leo");
    fireEvent.press(screen.getAllByText("Guardar cambios")[0]);
    await waitFor(() =>
      expect(accountsApi.renameParticipant).toHaveBeenCalledWith("acc1", "p-leandro", "Leo"),
    );

    fireEvent.changeText(screen.getByLabelText("Agregar participante"), "Martina");
    fireEvent.press(screen.getByText("Agregar"));
    await waitFor(() => expect(accountsApi.addParticipant).toHaveBeenCalledWith("acc1", "Martina"));
  });

  it("shares the web invitation link", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    (accountsApi.get as jest.Mock).mockResolvedValue(makeAccount());
    renderScreen(<AccountDetailScreen />);
    fireEvent.press(await screen.findByText("Compartir"));
    expect(share).toHaveBeenCalledWith({
      message: "http://localhost:3000/invite/abcdefghijklmnopqrstuv",
    });
  });
});

describe("leave (US4)", () => {
  it("a member leaves after confirming; the owner has no leave option", async () => {
    (accountsApi.get as jest.Mock).mockResolvedValue(memberView());
    (accountsApi.leave as jest.Mock).mockResolvedValue(undefined);
    renderScreen(<AccountDetailScreen />);
    fireEvent.press(await screen.findByText("Salir de la Cuenta"));
    fireEvent.press(await screen.findByText("Continuar"));
    await waitFor(() => expect(accountsApi.leave).toHaveBeenCalledWith("acc1"));
    expect(mockRouter.replace).toHaveBeenCalledWith("/accounts");
    expect(screen.queryByText("Generar enlace nuevo")).toBeNull();
  });
});

describe("removal impact (US4)", () => {
  it("the dialog says how many expenses change, or that it could not count them", async () => {
    (accountsApi.get as jest.Mock).mockResolvedValue(makeAccount());
    (expensesApi.participantImpact as jest.Mock).mockResolvedValueOnce({ affectedExpenses: 2 });
    renderScreen(<AccountDetailScreen />);
    await screen.findByText("Leandro");
    fireEvent.press(screen.getByText("Quitar"));
    expect(await screen.findByText(/Se verán afectados 2 gastos/)).toBeOnTheScreen();
    expect(expensesApi.participantImpact).toHaveBeenCalledWith("acc1", "p-leandro");
    fireEvent.press(screen.getByText("Cancelar"));
    await new Promise((resolve) => setTimeout(resolve, 300));

    (expensesApi.participantImpact as jest.Mock).mockRejectedValueOnce(new Error("offline"));
    fireEvent.press(screen.getByText("Quitar"));
    expect(await screen.findByText(/No pudimos calcular/)).toBeOnTheScreen();
    expect(screen.getByText("Continuar")).toBeOnTheScreen();
  });
});
