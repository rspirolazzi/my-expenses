import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConfirmDialog } from "@/components/accounts/ConfirmDialog";

import { renderWithIntl } from "../support/render";

function setup() {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  renderWithIntl(
    <ConfirmDialog
      open
      title="¿Seguro?"
      message="Texto"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

it("Cancelar does not confirm and has the initial focus", async () => {
  const { onConfirm, onCancel } = setup();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(onCancel).toHaveBeenCalled();
  expect(onConfirm).not.toHaveBeenCalled();
});

it("Continuar confirms and Escape cancels", async () => {
  const { onConfirm, onCancel } = setup();
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
  expect(onConfirm).toHaveBeenCalled();
  await userEvent.keyboard("{Escape}");
  expect(onCancel).toHaveBeenCalled();
});

it("renders nothing when closed", () => {
  renderWithIntl(
    <ConfirmDialog open={false} title="x" message="y" onConfirm={jest.fn()} onCancel={jest.fn()} />,
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
