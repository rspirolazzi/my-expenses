import { screen, within } from "@testing-library/react-native";

import { BalanceSummary } from "@/components/balances/BalanceSummary";
import i18n from "@/i18n";
import { AccountListItems } from "@/screens/accounts/AccountsScreen";

import { makeSummary } from "../support/accounts";
import { renderScreen } from "../support/render";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

beforeEach(async () => {
  await i18n.changeLanguage("es");
});

it("shows the totals by currency, closed accounts included (US5)", () => {
  renderScreen(
    <BalanceSummary
      locale="es"
      accounts={[
        makeSummary({ id: "a", myBalance: "60.00" }),
        makeSummary({ id: "b", myBalance: "-10.00", isClosed: true }),
        makeSummary({ id: "c", currency: "USD", myBalance: "-5.00" }),
      ]}
    />,
  );
  const owed = screen.getByTestId("owed-to-me");
  expect(within(owed).getByText("Te deben")).toBeOnTheScreen();
  expect(within(owed).getByText(/60,00 ARS/)).toBeOnTheScreen();
  expect(within(owed).queryByText(/US\$/)).toBeNull();
  const owe = screen.getByTestId("i-owe");
  expect(within(owe).getByText(/10,00 ARS/)).toBeOnTheScreen();
  expect(within(owe).getByText(/5,00 US\$/)).toBeOnTheScreen();
});

it("says when everything is settled up", () => {
  renderScreen(<BalanceSummary locale="es" accounts={[makeSummary()]} />);
  expect(screen.getByText("Estás al día en todas tus Cuentas.")).toBeOnTheScreen();
});

it("shows my balance in each account and the closed mark", () => {
  renderScreen(
    <AccountListItems
      accounts={[
        makeSummary({ id: "a", name: "Viaje", myBalance: "-12.50" }),
        makeSummary({ id: "b", name: "Casa", myBalance: "0.00", isClosed: true }),
      ]}
    />,
  );
  expect(screen.getByText(/Debés 12,50 ARS/)).toBeOnTheScreen();
  expect(screen.getByText("Estás al día")).toBeOnTheScreen();
  expect(screen.getByText("Cerrada")).toBeOnTheScreen();
});
