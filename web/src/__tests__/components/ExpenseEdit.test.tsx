import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { deleteExpenseAction, updateExpenseAction } from "@/app/actions/expenses";
import { ExpenseDetail } from "@/components/expenses/ExpenseDetail";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";

import { makeAccount, makeExpense } from "../support/accounts";
import { router } from "../support/mocks";
import { renderWithIntl } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("@/app/actions/expenses", () => ({
  createExpenseAction: jest.fn(),
  updateExpenseAction: jest.fn(),
  deleteExpenseAction: jest.fn(),
}));

const update = updateExpenseAction as jest.Mock;
const remove = deleteExpenseAction as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

it("edits with the current values and the version it read", async () => {
  update.mockResolvedValue({ ok: true, data: makeExpense({ version: 2 }) });
  renderWithIntl(<ExpenseForm account={makeAccount()} expense={makeExpense({ version: 4 })} />);
  expect(screen.getByLabelText("Concepto")).toHaveValue("Cena");
  expect(screen.getByLabelText("Importe (ARS)")).toHaveValue("100,00");
  expect(screen.getByLabelText("Fecha")).toHaveValue("2026-11-11");
  await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));
  expect(update).toHaveBeenCalledWith(
    "acc1",
    "exp1",
    expect.objectContaining({ amount: "100.00" }),
    4,
  );
});

it("on a conflict shows the notice and loads the current version", async () => {
  const current = makeExpense({ title: "Cena de B", amount: "120.00", version: 5 });
  update
    .mockResolvedValueOnce({ ok: false, code: "expense_conflict", details: { current } })
    .mockResolvedValueOnce({ ok: true, data: current });
  renderWithIntl(<ExpenseForm account={makeAccount()} expense={makeExpense()} />);
  await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Otro miembro cambió este gasto");
  expect(screen.getByLabelText("Concepto")).toHaveValue("Cena de B");
  expect(screen.getByLabelText("Importe (ARS)")).toHaveValue("120,00");
  await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));
  expect(update.mock.calls[1][3]).toBe(5);
});

it("a pending expense needs a payer before saving", async () => {
  renderWithIntl(
    <ExpenseForm
      account={makeAccount()}
      expense={makeExpense({ paidBy: null, participants: [], isPending: true })}
    />,
  );
  expect(screen.getByLabelText("Pagó")).toHaveValue("");
  await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Elegí quién pagó");
  expect(update).not.toHaveBeenCalled();
});

it("tells when the expense no longer exists", async () => {
  update.mockResolvedValue({ ok: false, code: "not_found" });
  renderWithIntl(<ExpenseForm account={makeAccount()} expense={makeExpense()} />);
  await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));
  expect(screen.getByRole("alert")).toHaveTextContent("ya no existe");
  expect(screen.getByRole("link", { name: "Volver a la Cuenta" })).toHaveAttribute(
    "href",
    "/accounts/acc1",
  );
});

it("shows the shares and deletes after confirming", async () => {
  remove.mockResolvedValue({ ok: true, data: null });
  renderWithIntl(<ExpenseDetail account={makeAccount()} expense={makeExpense({ version: 3 })} />);
  expect(screen.getAllByText(/33,33/)).toHaveLength(2);
  expect(screen.getByText(/33,34/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("¿Eliminar este gasto?");
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(remove).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
  expect(remove).toHaveBeenCalledWith("acc1", "exp1", 3);
  expect(router.push).toHaveBeenCalledWith("/accounts/acc1");
});

it("a closed account offers no edit or delete", () => {
  renderWithIntl(
    <ExpenseDetail account={makeAccount({ isClosed: true })} expense={makeExpense()} />,
  );
  expect(screen.queryByRole("link", { name: "Editar" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
});

it("marks pending expenses", () => {
  renderWithIntl(
    <ExpenseDetail
      account={makeAccount()}
      expense={makeExpense({ paidBy: null, isPending: true })}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Pendiente de asignación");
  expect(screen.getByText("Sin pagador")).toBeInTheDocument();
});
