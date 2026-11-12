import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProfilePage from "@/app/(private)/profile/page";

import { messages, renderWithIntl } from "../support/render";

jest.mock("@/auth", () => ({
  auth: jest.fn(async () => ({ user: require("../support/render").userResponse })),
}));
jest.mock("next-intl/server", () => ({
  getTranslations: jest.fn(async (namespace: string) => {
    const group = (messages.es as unknown as Record<string, Record<string, string>>)[namespace];
    return (key: string) => group[key];
  }),
}));
jest.mock("@/components/ProfileForms", () => ({
  ProfileForm: () => null,
  PreferencesForm: () => null,
  EmailChangeForm: () => null,
}));

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
});

it("offers 'Export my data' with both formats from the profile (US2)", async () => {
  fetchMock.mockReturnValue(new Promise(() => {}));
  const page = await ProfilePage();
  if (!page) throw new Error("the profile page needs a session");
  renderWithIntl(page);
  expect(screen.getByRole("heading", { name: "Exportar mis datos" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Exportar mis datos" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "JSON" }));
  expect(fetchMock).toHaveBeenCalledWith("/api/exports/me?format=json", { method: "POST" });
});
