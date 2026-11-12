import { screen } from "@testing-library/react";

import { LEGAL_SECTIONS, LegalPage } from "@/components/LegalPage";
import { SiteFooter } from "@/components/SiteHeader";

import { renderWithIntl } from "../support/render";

jest.mock("@/app/actions/auth", () => ({ signOutAction: jest.fn() }));

it("the footer shows the slogan and links to the privacy and terms pages", () => {
  renderWithIntl(<SiteFooter />);
  expect(screen.getByText("ChePagame. Para que la guita no sea un problema.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Privacidad" })).toHaveAttribute("href", "/privacy");
  expect(screen.getByRole("link", { name: "Términos" })).toHaveAttribute("href", "/terms");
});

it("shows the privacy page with every section in Spanish", () => {
  renderWithIntl(<LegalPage kind="privacy" />);
  expect(screen.getByRole("heading", { level: 1, name: "Privacidad" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(LEGAL_SECTIONS.privacy.length);
  expect(screen.getByRole("heading", { name: "Tus datos son tuyos" })).toBeInTheDocument();
  expect(screen.getByText(/Última actualización/)).toBeInTheDocument();
});

it("shows the terms page in English", () => {
  renderWithIntl(<LegalPage kind="terms" />, { locale: "en" });
  expect(screen.getByRole("heading", { level: 1, name: "Terms" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(LEGAL_SECTIONS.terms.length);
  expect(screen.getByText(/does not move money/)).toBeInTheDocument();
});
