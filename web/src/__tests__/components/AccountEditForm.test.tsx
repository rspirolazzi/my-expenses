import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { updateAccountAction } from "@/app/actions/accounts";
import { AccountEditForm } from "@/components/accounts/AccountEditForm";

import { makeAccount } from "../support/accounts";
import { renderWithIntl } from "../support/render";

jest.mock("@/app/actions/accounts", () => ({ updateAccountAction: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

it("saves name, description and icon; an emptied description is sent as null", async () => {
  const onChange = jest.fn();
  (updateAccountAction as jest.Mock).mockResolvedValue({ ok: true, data: makeAccount() });
  renderWithIntl(
    <AccountEditForm account={makeAccount({ description: "Enero" })} onChange={onChange} />,
  );
  await userEvent.clear(screen.getByLabelText("Nombre"));
  await userEvent.type(screen.getByLabelText("Nombre"), "Brasil");
  await userEvent.clear(screen.getByLabelText("Descripción (opcional)"));
  await userEvent.click(screen.getByRole("radio", { name: "Playa" }));
  await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(updateAccountAction).toHaveBeenCalledWith("acc1", {
    name: "Brasil",
    description: null,
    icon: "beach",
  });
  expect(await screen.findByRole("status")).toHaveTextContent("Cambios guardados.");
});

it("closed accounts cannot be edited", () => {
  renderWithIntl(
    <AccountEditForm account={makeAccount({ isClosed: true })} onChange={jest.fn()} />,
  );
  expect(screen.getByLabelText("Nombre")).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
});
