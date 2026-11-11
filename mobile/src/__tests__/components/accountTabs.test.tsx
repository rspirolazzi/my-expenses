import { fireEvent, screen } from "@testing-library/react-native";

import { AccountTabs } from "@/components/accounts/AccountTabs";
import i18n from "@/i18n";

import { renderScreen } from "../support/render";

const mockRouter = { replace: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage("es");
});

it("goes to the balances tab replacing the screen", () => {
  renderScreen(<AccountTabs accountId="acc1" active="expenses" />);
  fireEvent.press(screen.getByText("Saldos"));
  expect(mockRouter.replace).toHaveBeenCalledWith({
    pathname: "/accounts/[accountId]/balances",
    params: { accountId: "acc1" },
  });
});

it("goes back to the expenses tab", () => {
  renderScreen(<AccountTabs accountId="acc1" active="balances" />);
  fireEvent.press(screen.getByText("Gastos"));
  expect(mockRouter.replace).toHaveBeenCalledWith({
    pathname: "/accounts/[accountId]",
    params: { accountId: "acc1" },
  });
});

it("does nothing on the active tab", async () => {
  await i18n.changeLanguage("en");
  renderScreen(<AccountTabs accountId="acc1" active="balances" />);
  fireEvent.press(screen.getByText("Balances"));
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
