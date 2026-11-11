import { screen } from "@testing-library/react";

import { AccountTabs } from "@/components/accounts/AccountTabs";

import { renderWithIntl } from "../support/render";

it("links both tabs and marks the active one", () => {
  renderWithIntl(<AccountTabs accountId="acc1" active="balances" />);
  const expenses = screen.getByRole("link", { name: "Gastos" });
  const balances = screen.getByRole("link", { name: "Saldos" });
  expect(expenses).toHaveAttribute("href", "/accounts/acc1");
  expect(expenses).not.toHaveAttribute("aria-current");
  expect(balances).toHaveAttribute("href", "/accounts/acc1/balances");
  expect(balances).toHaveAttribute("aria-current", "page");
});

it("is translated", () => {
  renderWithIntl(<AccountTabs accountId="acc1" active="expenses" />, { locale: "en" });
  expect(screen.getByRole("link", { name: "Expenses" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Balances" })).toBeInTheDocument();
});
