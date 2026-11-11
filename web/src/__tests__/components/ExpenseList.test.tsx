import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { loadMoreExpensesAction } from "@/app/actions/expenses";
import { ExpenseList } from "@/components/expenses/ExpenseList";

import { makeAccount, makeListItem } from "../support/accounts";
import { router } from "../support/mocks";
import { renderWithIntl } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("@/app/actions/expenses", () => ({ loadMoreExpensesAction: jest.fn() }));

const loadMore = loadMoreExpensesAction as jest.Mock;

beforeEach(() => jest.clearAllMocks());

const page = {
  items: [
    makeListItem({ id: "a", date: "2026-11-11", title: "Cena" }),
    makeListItem({
      id: "b",
      date: "2026-11-10",
      title: "Nafta",
      categoryIcon: "car",
      paidBy: null,
      isPending: true,
    }),
  ],
  nextCursor: "c1",
  total: "1234.50",
  count: 3,
};

it("shows the total, day groups and each row", () => {
  renderWithIntl(<ExpenseList account={makeAccount()} firstPage={page} />);
  expect(screen.getByText("Total gastado")).toBeInTheDocument();
  expect(screen.getByText(/1\.?234,50/)).toBeInTheDocument();
  expect(screen.getByText("3 gastos")).toBeInTheDocument();
  const days = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
  expect(days[0]).toMatch(/11 de noviembre/);
  expect(days[1]).toMatch(/10 de noviembre/);

  const cena = screen.getByRole("link", { name: /Cena/ });
  expect(cena).toHaveAttribute("href", "/accounts/acc1/expenses/a");
  expect(cena).toHaveTextContent("Pagó Ana");
  expect(within(cena).getByRole("img", { name: "Comida" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Nafta/ })).toHaveTextContent("Pendiente de asignación");
});

it("loads the next page keeping one group per day and no repeats", async () => {
  loadMore.mockResolvedValue({
    ok: true,
    data: {
      items: [
        makeListItem({ id: "b", date: "2026-11-10", title: "Nafta" }),
        makeListItem({ id: "c", date: "2026-11-10", title: "Peaje" }),
      ],
      nextCursor: null,
      total: null,
      count: null,
    },
  });
  renderWithIntl(<ExpenseList account={makeAccount()} firstPage={page} />);
  await userEvent.click(screen.getByRole("button", { name: "Cargar más" }));
  expect(loadMore).toHaveBeenCalledWith("acc1", "c1");
  expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  expect(screen.getAllByRole("link", { name: /Nafta/ })).toHaveLength(1);
  expect(screen.getByRole("link", { name: /Peaje/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cargar más" })).not.toBeInTheDocument();
});

it("refreshes only when asked", async () => {
  renderWithIntl(<ExpenseList account={makeAccount()} firstPage={page} />);
  expect(router.refresh).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
  expect(router.refresh).toHaveBeenCalled();
});

it("empty state invites to add the first one unless the account is closed", () => {
  const empty = { items: [], nextCursor: null, total: "0.00", count: 0 };
  const { unmount } = renderWithIntl(<ExpenseList account={makeAccount()} firstPage={empty} />);
  expect(screen.getByText(/Cargá el primero/)).toBeInTheDocument();
  unmount();
  renderWithIntl(<ExpenseList account={makeAccount({ isClosed: true })} firstPage={empty} />);
  expect(screen.getByText(/Todavía no hay gastos/)).toBeInTheDocument();
  expect(screen.queryByText(/Cargá el primero/)).not.toBeInTheDocument();
});
