import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { deleteSettlementAction, loadMoreSettlementsAction } from "@/app/actions/settlements";
import { SettlementList } from "@/components/balances/SettlementList";

import { makeAccount, makeSettlement } from "../support/accounts";
import { router } from "../support/mocks";
import { renderWithIntl } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("@/app/actions/settlements", () => ({
  deleteSettlementAction: jest.fn(),
  loadMoreSettlementsAction: jest.fn(),
}));

const remove = deleteSettlementAction as jest.Mock;
const loadMore = loadMoreSettlementsAction as jest.Mock;

const page = {
  items: [
    makeSettlement({ id: "s1" }),
    makeSettlement({
      id: "s2",
      date: "2026-11-10",
      from: { id: "p-diego", name: "Diego" },
      amount: "5.00",
      isExcluded: true,
    }),
  ],
  nextCursor: "c1",
};

beforeEach(() => jest.clearAllMocks());

describe("list (US3)", () => {
  it("shows date, who paid, who received and the amount", () => {
    renderWithIntl(<SettlementList account={makeAccount()} firstPage={page} />);
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("Leandro le pagó a Ana")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/11 nov/)).toBeInTheDocument();
    expect(within(rows[0]).getByText(/30,00 ARS/)).toBeInTheDocument();
    expect(within(rows[0]).queryByText("Participante quitado")).not.toBeInTheDocument();
    expect(within(rows[1]).getByText("Participante quitado")).toBeInTheDocument();
    expect(rows[1]).toHaveClass("excluded");
  });

  it("loads more without repeats", async () => {
    loadMore.mockResolvedValue({
      ok: true,
      data: {
        items: [makeSettlement({ id: "s2" }), makeSettlement({ id: "s3" })],
        nextCursor: null,
      },
    });
    renderWithIntl(<SettlementList account={makeAccount()} firstPage={page} />);
    await userEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    expect(loadMore).toHaveBeenCalledWith("acc1", "c1");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Cargar más" })).not.toBeInTheDocument();
  });

  it("empty state", () => {
    renderWithIntl(
      <SettlementList account={makeAccount()} firstPage={{ items: [], nextCursor: null }} />,
    );
    expect(screen.getByText("Todavía no hay reembolsos registrados.")).toBeInTheDocument();
  });
});

describe("delete (US4)", () => {
  it("asks with Continuar/Cancelar and only Continuar deletes", async () => {
    remove.mockResolvedValue({ ok: true, data: null });
    renderWithIntl(<SettlementList account={makeAccount()} firstPage={page} />);
    const first = screen.getAllByRole("listitem")[0];
    await userEvent.click(within(first).getByRole("button", { name: "Eliminar" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("¿Eliminar este reembolso?");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(remove).not.toHaveBeenCalled();

    await userEvent.click(within(first).getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(remove).toHaveBeenCalledWith("acc1", "s1");
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("tells when another member already deleted it", async () => {
    remove.mockResolvedValue({ ok: false, code: "not_found" });
    renderWithIntl(<SettlementList account={makeAccount()} firstPage={page} />);
    await userEvent.click(
      within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "Eliminar" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Este reembolso ya no existe: lo eliminó otro miembro.",
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it("closed accounts do not offer delete", () => {
    renderWithIntl(<SettlementList account={makeAccount({ isClosed: true })} firstPage={page} />);
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
  });
});
