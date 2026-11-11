import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BalanceList } from "@/components/balances/BalanceList";

import { makeAccount, makeBalances } from "../support/accounts";
import { router } from "../support/mocks";
import { renderWithIntl } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));

beforeEach(() => jest.clearAllMocks());

it("shows each balance and highlights mine in plain words", () => {
  renderWithIntl(<BalanceList account={makeAccount()} balances={makeBalances()} />);
  const rows = screen.getAllByRole("listitem");
  expect(rows).toHaveLength(3);
  expect(rows[0]).toHaveClass("me");
  expect(within(rows[0]).getByText(/Te deben 60,00 ARS/)).toBeInTheDocument();
  expect(within(rows[1]).getByText("Leandro")).toBeInTheDocument();
  expect(within(rows[1]).getByText(/Debe 30,00 ARS/)).toBeInTheDocument();
  expect(rows[1]).not.toHaveClass("me");
});

it("tells me when I owe or I am settled up", () => {
  const owe = makeBalances({
    balances: [
      { participant: { id: "p-ana", name: "Ana" }, amount: "-30.00", isMe: true },
      { participant: { id: "p-leandro", name: "Leandro" }, amount: "30.00", isMe: false },
    ],
  });
  const { unmount } = renderWithIntl(<BalanceList account={makeAccount()} balances={owe} />);
  expect(screen.getByText(/Debés 30,00 ARS/)).toBeInTheDocument();
  expect(screen.getByText(/Le deben 30,00 ARS/)).toBeInTheDocument();
  unmount();
  const settled = makeBalances({
    balances: [
      { participant: { id: "p-ana", name: "Ana" }, amount: "0.00", isMe: true },
      { participant: { id: "p-leandro", name: "Leandro" }, amount: "0.00", isMe: false },
    ],
    suggestions: [],
  });
  renderWithIntl(<BalanceList account={makeAccount()} balances={settled} />);
  expect(screen.getByText("Estás al día")).toBeInTheDocument();
  expect(screen.getByText("No hay deudas: todos están al día.")).toBeInTheDocument();
});

it("formats in English", () => {
  renderWithIntl(<BalanceList account={makeAccount()} balances={makeBalances()} />, {
    locale: "en",
  });
  expect(screen.getByText(/You are owed ARS\s*60\.00/)).toBeInTheDocument();
  expect(screen.getAllByText(/Owes ARS\s*30\.00/)).toHaveLength(2);
});

it("warns about pending expenses and links to the expenses tab", () => {
  renderWithIntl(
    <BalanceList account={makeAccount()} balances={makeBalances({ pendingExpenses: 1 })} />,
  );
  expect(screen.getByText("1 gasto pendiente")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Completarlos en Gastos" })).toHaveAttribute(
    "href",
    "/accounts/acc1",
  );
});

it("refreshes only when asked", async () => {
  renderWithIntl(<BalanceList account={makeAccount()} balances={makeBalances()} />);
  expect(router.refresh).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
  expect(router.refresh).toHaveBeenCalled();
});
