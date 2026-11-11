import { screen, within } from "@testing-library/react";

import { BalanceSummary } from "@/components/balances/BalanceSummary";

import { makeSummary } from "../support/accounts";
import { renderWithIntl } from "../support/render";

it("shows the totals by currency", () => {
  renderWithIntl(
    <BalanceSummary
      accounts={[
        makeSummary({ id: "a", myBalance: "60.00" }),
        makeSummary({ id: "b", myBalance: "-10.00", isClosed: true }),
        makeSummary({ id: "c", currency: "USD", myBalance: "-5.00" }),
      ]}
    />,
  );
  const owed = screen.getByRole("group", { name: "Te deben" });
  expect(within(owed).getByText(/60,00 ARS/)).toBeInTheDocument();
  expect(within(owed).queryByText(/US\$/)).not.toBeInTheDocument();
  const owe = screen.getByRole("group", { name: "Debés" });
  expect(within(owe).getByText(/10,00 ARS/)).toBeInTheDocument();
  expect(within(owe).getByText(/5,00 US\$/)).toBeInTheDocument();
});

it("says when everything is settled up", () => {
  renderWithIntl(<BalanceSummary accounts={[makeSummary()]} />);
  expect(screen.getByText("Estás al día en todas tus Cuentas.")).toBeInTheDocument();
});
