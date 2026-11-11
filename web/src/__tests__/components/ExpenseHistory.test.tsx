import { screen } from "@testing-library/react";

import { ExpenseHistory } from "@/components/expenses/ExpenseHistory";

import { makeAccount, makeHistory } from "../support/accounts";
import { renderWithIntl } from "../support/render";

it("lists the changes, most recent first, readable", () => {
  renderWithIntl(<ExpenseHistory account={makeAccount()} entries={makeHistory()} />);
  const items = screen.getAllByRole("listitem").filter((li) => li.parentElement?.tagName === "OL");
  expect(items[0]).toHaveTextContent("Ana modificó el gasto");
  expect(items[0]).toHaveTextContent("Ajuste automático al quitar a un participante");
  expect(items[0]).toHaveTextContent("Pagó: Javier → (vacío)");

  expect(items[1]).toHaveTextContent("Un miembro modificó el gasto");
  expect(items[1].textContent).toMatch(/Importe: .*90,00.* → .*120,00/);

  expect(items[2]).toHaveTextContent("Ana cargó el gasto");
  expect(items[2]).not.toHaveTextContent("Concepto:");
  expect(items[2].textContent).toMatch(/2026/);
});

it("shows an empty state", () => {
  renderWithIntl(<ExpenseHistory account={makeAccount()} entries={[]} />);
  expect(screen.getByText("Todavía no hay cambios.")).toBeInTheDocument();
});
