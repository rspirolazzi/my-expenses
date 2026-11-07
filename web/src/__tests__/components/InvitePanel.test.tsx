import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { regenerateInviteAction } from "@/app/actions/accounts";
import { InvitePanel } from "@/components/accounts/InvitePanel";

import { makeAccount, memberView } from "../support/accounts";
import { renderWithIntl } from "../support/render";

jest.mock("@/app/actions/accounts", () => ({ regenerateInviteAction: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

it("shows the invitation link and copies it", async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  renderWithIntl(<InvitePanel account={makeAccount()} onChange={jest.fn()} />);
  const url = `${window.location.origin}/invite/abcdefghijklmnopqrstuv`;
  expect(screen.getByRole("textbox")).toHaveValue(url);
  await userEvent.click(screen.getByRole("button", { name: "Copiar enlace" }));
  expect(writeText).toHaveBeenCalledWith(url);
  expect(await screen.findByRole("status")).toHaveTextContent("Enlace copiado.");
});

it("only the owner can regenerate, after confirming", async () => {
  const onChange = jest.fn();
  const next = makeAccount({ inviteCode: "zzzzzzzzzzzzzzzzzzzzzz" });
  (regenerateInviteAction as jest.Mock).mockResolvedValue({ ok: true, data: next });
  renderWithIntl(<InvitePanel account={makeAccount()} onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "Generar enlace nuevo" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("deja de funcionar");
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
  expect(regenerateInviteAction).toHaveBeenCalledWith("acc1");
  expect(onChange).toHaveBeenCalledWith(next);
});

it("members do not see the regenerate option", () => {
  renderWithIntl(<InvitePanel account={memberView()} onChange={jest.fn()} />);
  expect(screen.queryByRole("button", { name: "Generar enlace nuevo" })).not.toBeInTheDocument();
});

it("closed accounts have no invitation panel", () => {
  renderWithIntl(<InvitePanel account={makeAccount({ isClosed: true })} onChange={jest.fn()} />);
  expect(screen.queryByText("Invitar")).not.toBeInTheDocument();
});
