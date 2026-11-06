import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  confirmEmailChangeAction,
  requestEmailChangeAction,
  updateMeAction,
} from "@/app/actions/profile";
import { EmailChangeForm, ProfileForm } from "@/components/ProfileForms";

import { renderWithIntl, userResponse } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("next-themes", () => ({ useTheme: () => ({ setTheme: jest.fn() }) }));
jest.mock("@/app/actions/profile", () => ({
  updateMeAction: jest.fn(),
  requestEmailChangeAction: jest.fn(),
  confirmEmailChangeAction: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

describe("ProfileForm", () => {
  it("sends an emptied field as null", async () => {
    (updateMeAction as jest.Mock).mockResolvedValue({ ok: true, data: userResponse });
    renderWithIntl(<ProfileForm user={{ ...userResponse, firstName: "Ana", lastName: "Paz" }} />);
    await userEvent.clear(screen.getByLabelText("Apellido"));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(updateMeAction).toHaveBeenCalledWith({ firstName: "Ana", lastName: null });
    expect(await screen.findByRole("status")).toHaveTextContent("Cambios guardados.");
  });

  it("limits names to 60 characters", () => {
    renderWithIntl(<ProfileForm user={userResponse} />);
    expect(screen.getByLabelText("Nombre")).toHaveAttribute("maxLength", "60");
  });
});

describe("EmailChangeForm", () => {
  it("asks for the new email, then the code", async () => {
    (requestEmailChangeAction as jest.Mock).mockResolvedValue({ ok: true });
    (confirmEmailChangeAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { ...userResponse, email: "new@mail.com" },
    });
    renderWithIntl(<EmailChangeForm user={userResponse} />);

    await userEvent.type(screen.getByLabelText("Email nuevo"), "new@mail.com");
    await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(requestEmailChangeAction).toHaveBeenCalledWith("new@mail.com");

    await userEvent.type(await screen.findByLabelText("Código"), "123456");
    expect(confirmEmailChangeAction).toHaveBeenCalledWith("123456");
    expect(await screen.findByRole("status")).toHaveTextContent("new@mail.com");
  });
});
