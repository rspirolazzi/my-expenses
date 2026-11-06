import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { googleSignInAction } from "@/app/actions/auth";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

import { renderWithIntl } from "../support/render";

jest.mock("@/app/actions/auth", () => ({ googleSignInAction: jest.fn() }));

it("starts the Google sign-in keeping the callback URL", async () => {
  renderWithIntl(<GoogleSignInButton callbackUrl="/profile" />, { locale: "en" });
  await userEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
  expect(googleSignInAction).toHaveBeenCalledWith("/profile");
});
