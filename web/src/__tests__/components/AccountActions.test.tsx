import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  closeAccountAction,
  deleteAccountAction,
  leaveAccountAction,
} from "@/app/actions/accounts";
import { AccountActions } from "@/components/accounts/AccountActions";

import { makeAccount, memberView } from "../support/accounts";
import { router } from "../support/mocks";
import { renderWithIntl } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("@/app/actions/accounts", () => ({
  closeAccountAction: jest.fn(),
  deleteAccountAction: jest.fn(),
  leaveAccountAction: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  router.push.mockReset();
});

describe("member (US4)", () => {
  it("can leave after confirming and goes back to the list", async () => {
    (leaveAccountAction as jest.Mock).mockResolvedValue({ ok: true, data: null });
    renderWithIntl(<AccountActions account={memberView()} onChange={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Cerrar Cuenta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dar de baja la Cuenta" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salir de la Cuenta" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(leaveAccountAction).toHaveBeenCalledWith("acc1");
    expect(router.push).toHaveBeenCalledWith("/accounts");
  });
});

describe("owner (US5)", () => {
  it("cannot leave; closing warns that it is final", async () => {
    const onChange = jest.fn();
    const closed = makeAccount({ isClosed: true });
    (closeAccountAction as jest.Mock).mockResolvedValue({ ok: true, data: closed });
    renderWithIntl(<AccountActions account={makeAccount()} onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "Salir de la Cuenta" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar Cuenta" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("definitivo");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onChange).toHaveBeenCalledWith(closed);
  });

  it("deleting shows Continuar/Cancelar; Cancelar does nothing", async () => {
    (deleteAccountAction as jest.Mock).mockResolvedValue({ ok: true, data: null });
    renderWithIntl(<AccountActions account={makeAccount()} onChange={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Dar de baja la Cuenta" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("todos sus gastos");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(deleteAccountAction).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Dar de baja la Cuenta" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(deleteAccountAction).toHaveBeenCalledWith("acc1");
    expect(router.push).toHaveBeenCalledWith("/accounts");
  });

  it("a closed account can still be deleted, but not closed again", () => {
    renderWithIntl(
      <AccountActions account={makeAccount({ isClosed: true })} onChange={jest.fn()} />,
    );
    expect(screen.queryByRole("button", { name: "Cerrar Cuenta" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dar de baja la Cuenta" })).toBeInTheDocument();
  });
});
