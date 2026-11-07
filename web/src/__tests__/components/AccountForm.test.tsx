import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAccountAction } from "@/app/actions/accounts";
import { AccountForm } from "@/components/accounts/AccountForm";

import { router } from "../support/mocks";
import { makeAccount } from "../support/accounts";
import { renderWithIntl } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("@/app/actions/accounts", () => ({ createAccountAction: jest.fn() }));

const createMock = createAccountAction as jest.Mock;

beforeEach(() => {
  createMock.mockReset();
  router.push.mockReset();
});

it("prefills the currency and the creator's name, with the default icon", () => {
  renderWithIntl(<AccountForm defaultCurrency="BRL" myName="Ana García" />);
  expect(screen.getByLabelText("Moneda")).toHaveValue("BRL");
  expect(screen.getByLabelText("Tu nombre en esta Cuenta")).toHaveValue("Ana García");
  expect(screen.getByRole("radio", { name: "Grupo" })).toBeChecked();
});

it("detects duplicate names before calling the API", async () => {
  renderWithIntl(<AccountForm defaultCurrency="ARS" myName="Ana" />);
  await userEvent.type(screen.getByLabelText("Nombre"), "Viaje");
  await userEvent.type(screen.getByLabelText("Nombre 1"), " ana ");
  await userEvent.click(screen.getByRole("button", { name: "Crear Cuenta" }));
  expect(screen.getByRole("alert")).toHaveTextContent("nombres repetidos");
  expect(createMock).not.toHaveBeenCalled();
});

it("adds and removes participant rows, then creates the account", async () => {
  createMock.mockResolvedValue({ ok: true, data: makeAccount({ id: "new-id" }) });
  renderWithIntl(<AccountForm defaultCurrency="ARS" myName="Ana" />);
  await userEvent.type(screen.getByLabelText("Nombre"), "Viaje");
  await userEvent.type(screen.getByLabelText("Nombre 1"), "Leandro");
  await userEvent.click(screen.getByRole("button", { name: "Agregar participante" }));
  await userEvent.type(screen.getByLabelText("Nombre 2"), "Borrar");
  await userEvent.click(screen.getByRole("button", { name: "Quitar fila 2" }));
  await userEvent.click(screen.getByRole("radio", { name: "Playa" }));
  await userEvent.click(screen.getByRole("button", { name: "Crear Cuenta" }));

  expect(createMock).toHaveBeenCalledWith({
    name: "Viaje",
    description: "",
    icon: "beach",
    currency: "ARS",
    myParticipantName: "Ana",
    otherParticipants: ["Leandro"],
  });
  expect(router.push).toHaveBeenCalledWith("/accounts/new-id");
});
