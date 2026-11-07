import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  addParticipantAction,
  removeParticipantAction,
  renameParticipantAction,
} from "@/app/actions/accounts";
import { ParticipantList } from "@/components/accounts/ParticipantList";

import { makeAccount } from "../support/accounts";
import { renderWithIntl } from "../support/render";

jest.mock("@/app/actions/accounts", () => ({
  addParticipantAction: jest.fn(),
  removeParticipantAction: jest.fn(),
  renameParticipantAction: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

function row(name: string) {
  return screen.getByText(name).closest("li") as HTMLElement;
}

it("the owner's participant has no Quitar", () => {
  renderWithIntl(
    <ParticipantList account={makeAccount()} onChange={jest.fn()} onRemovedSelf={jest.fn()} />,
  );
  expect(within(row("Ana")).queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
  expect(within(row("Leandro")).getByRole("button", { name: "Quitar" })).toBeInTheDocument();
});

it("removing asks for confirmation", async () => {
  const onChange = jest.fn();
  (removeParticipantAction as jest.Mock).mockResolvedValue({ ok: true, data: makeAccount() });
  renderWithIntl(
    <ParticipantList account={makeAccount()} onChange={onChange} onRemovedSelf={jest.fn()} />,
  );
  await userEvent.click(within(row("Leandro")).getByRole("button", { name: "Quitar" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("¿Quitar a Leandro?");
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(removeParticipantAction).not.toHaveBeenCalled();

  await userEvent.click(within(row("Leandro")).getByRole("button", { name: "Quitar" }));
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
  expect(removeParticipantAction).toHaveBeenCalledWith("acc1", "p-leandro");
  expect(onChange).toHaveBeenCalled();
});

it("renames inline and adds participants, showing translated errors", async () => {
  (renameParticipantAction as jest.Mock).mockResolvedValue({ ok: true, data: makeAccount() });
  (addParticipantAction as jest.Mock).mockResolvedValue({
    ok: false,
    code: "duplicate_participant_name",
  });
  renderWithIntl(
    <ParticipantList account={makeAccount()} onChange={jest.fn()} onRemovedSelf={jest.fn()} />,
  );
  await userEvent.click(within(row("Javier")).getByRole("button", { name: "Renombrar" }));
  const input = screen.getByRole("textbox", { name: "Renombrar" });
  await userEvent.clear(input);
  await userEvent.type(input, "Javi");
  await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(renameParticipantAction).toHaveBeenCalledWith("acc1", "p-javier", "Javi");

  await userEvent.type(screen.getByRole("textbox", { name: "Agregar participante" }), "Leandro");
  await userEvent.click(screen.getByRole("button", { name: "Agregar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Ya hay un participante con ese nombre.",
  );
});

it("closed accounts are read-only", () => {
  renderWithIntl(
    <ParticipantList
      account={makeAccount({ isClosed: true })}
      onChange={jest.fn()}
      onRemovedSelf={jest.fn()}
    />,
  );
  expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Agregar" })).not.toBeInTheDocument();
});
