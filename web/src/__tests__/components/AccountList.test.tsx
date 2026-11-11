import { screen } from "@testing-library/react";

import { AccountList } from "@/components/accounts/AccountList";

import { renderWithIntl } from "../support/render";

const summary = {
  id: "a1",
  name: "Vacaciones",
  icon: "beach" as const,
  currency: "BRL",
  currencyDecimals: 2,
  isClosed: true,
  isOwner: true,
  participantCount: 3,
  updatedAt: "2026-11-06T12:00:00Z",
  myBalance: "-12.50",
};

it("shows count, closed badge and a date formatted in the user's language", () => {
  renderWithIntl(<AccountList accounts={[summary]} />);
  expect(screen.getByText("Vacaciones")).toBeInTheDocument();
  expect(screen.getByText(/3 participantes/)).toHaveTextContent("6 nov 2026");
  expect(screen.getByText("Cerrada")).toBeInTheDocument();
  expect(screen.getByRole("link")).toHaveAttribute("href", "/accounts/a1");
});

it("formats the date in English too", () => {
  renderWithIntl(<AccountList accounts={[summary]} />, { locale: "en" });
  expect(screen.getByText(/3 participants/)).toHaveTextContent("Nov 6, 2026");
});

it("shows the empty state", () => {
  renderWithIntl(<AccountList accounts={[]} />);
  expect(screen.getByText(/Todavía no tenés Cuentas/)).toBeInTheDocument();
});

it("shows my balance in each account with its currency", () => {
  renderWithIntl(<AccountList accounts={[summary, { ...summary, id: "a2", myBalance: "0.00" }]} />);
  expect(screen.getByText(/Debés 12,50 BRL/)).toBeInTheDocument();
  expect(screen.getByText("Estás al día")).toBeInTheDocument();
});
