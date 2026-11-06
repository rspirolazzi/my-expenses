import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { signOutAction } from "@/app/actions/auth";
import { LogoutButton } from "@/components/LogoutButton";

import { renderWithIntl } from "../support/render";

jest.mock("@/app/actions/auth", () => ({ signOutAction: jest.fn() }));

it("signs out through the server action", async () => {
  renderWithIntl(<LogoutButton label="Logout" />);
  await userEvent.click(screen.getByRole("button", { name: "Logout" }));
  expect(signOutAction).toHaveBeenCalledTimes(1);
});
