import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { updateMeAction } from "@/app/actions/profile";
import { PreferencesForm } from "@/components/ProfileForms";

import { router } from "../support/mocks";
import { renderWithIntl, userResponse } from "../support/render";

const setTheme = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("next-themes", () => ({ useTheme: () => ({ setTheme }) }));
jest.mock("@/app/actions/profile", () => ({
  updateMeAction: jest.fn(),
  requestEmailChangeAction: jest.fn(),
  confirmEmailChangeAction: jest.fn(),
}));

const updateMock = updateMeAction as jest.Mock;

beforeEach(() => {
  updateMock.mockReset();
  setTheme.mockReset();
  router.refresh.mockReset();
});

it("applies the theme before the API answers", async () => {
  let resolve: (value: unknown) => void = () => undefined;
  updateMock.mockReturnValue(new Promise((r) => (resolve = r)));
  renderWithIntl(<PreferencesForm user={userResponse} />);

  await userEvent.selectOptions(screen.getByLabelText("Tema"), "dark");
  expect(setTheme).toHaveBeenCalledWith("dark");
  expect(updateMock).toHaveBeenCalledWith({ preferences: { theme: "dark" } });
  resolve({ ok: true, data: userResponse });
});

it("refreshes the page in the new language after saving it", async () => {
  updateMock.mockResolvedValue({ ok: true, data: userResponse });
  renderWithIntl(<PreferencesForm user={userResponse} />);
  await userEvent.selectOptions(screen.getByLabelText("Idioma"), "en");
  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
});

it("reverts the change when the API fails", async () => {
  updateMock.mockResolvedValue({ ok: false, code: "internal_error" });
  renderWithIntl(<PreferencesForm user={userResponse} />);
  await userEvent.selectOptions(screen.getByLabelText("Tema"), "light");
  expect(await screen.findByRole("alert")).toHaveTextContent("error inesperado");
  expect(screen.getByLabelText("Tema")).toHaveValue("system");
  expect(setTheme).toHaveBeenLastCalledWith("system");
});
