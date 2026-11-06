import { screen } from "@testing-library/react";

import { SiteHeader } from "@/components/SiteHeader";

import { renderWithIntl, userResponse } from "../support/render";

jest.mock("@/app/actions/auth", () => ({ signOutAction: jest.fn() }));

it("shows the public navigation without a session", () => {
  renderWithIntl(<SiteHeader user={null} />);
  for (const name of ["Inicio", "Cómo funciona", "Quiénes somos", "Contacto", "Login / Registro"]) {
    expect(screen.getByRole("link", { name })).toBeInTheDocument();
  }
  expect(screen.queryByText("Logout")).not.toBeInTheDocument();
});

it("shows the user menu with Accounts, Profile and Logout when signed in", () => {
  renderWithIntl(<SiteHeader user={{ ...userResponse, firstName: "Ana" }} />);
  expect(screen.getByText("Ana")).toBeInTheDocument();
  expect(screen.getByText("Accounts")).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
  expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Login / Registro" })).not.toBeInTheDocument();
});

it("uses the email as name when there is none (FR-017)", () => {
  renderWithIntl(<SiteHeader user={userResponse} />, { locale: "en" });
  expect(screen.getByText("ana@mail.com")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "How it works" })).toBeInTheDocument();
});
