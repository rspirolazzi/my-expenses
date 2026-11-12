import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ExportButton } from "@/components/exports/ExportButton";
import { saveBlob } from "@/lib/download";

import { renderWithIntl } from "../support/render";

jest.mock("@/lib/download", () => ({
  ...jest.requireActual("@/lib/download"),
  saveBlob: jest.fn(),
}));

const save = saveBlob as jest.Mock;

function fileResponse(name: string) {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (header: string) =>
        header.toLowerCase() === "content-disposition"
          ? `attachment; filename="x.zip"; filename*=UTF-8''${encodeURIComponent(name)}`
          : "application/zip",
    },
    blob: async () => new Blob(["zip"]),
  };
}

function errorResponse(status: number, code: string) {
  return {
    ok: false,
    status,
    headers: { get: () => "application/json" },
    json: async () => ({ error: { code } }),
  };
}

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
});

it("exports in two clicks: Export, then the format (SC-002)", async () => {
  fetchMock.mockResolvedValueOnce(fileResponse("mis-gastos_vacaciones_2026-11-12.zip"));
  renderWithIntl(<ExportButton endpoint="/api/exports/accounts/a1" />);
  await userEvent.click(screen.getByRole("button", { name: "Exportar" }));
  expect(screen.getByRole("menuitem", { name: "JSON" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("menuitem", { name: "CSV (planilla)" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenCalledWith("/api/exports/accounts/a1?format=csv", {
    method: "POST",
  });
  expect(save.mock.calls[0][1]).toBe("mis-gastos_vacaciones_2026-11-12.zip");
});

it("shows progress and ignores a second click while exporting (FR-018)", async () => {
  let resolve: (value: unknown) => void = () => {};
  fetchMock.mockReturnValueOnce(new Promise((r) => (resolve = r)));
  renderWithIntl(<ExportButton endpoint="/api/exports/me" />);
  await userEvent.click(screen.getByRole("button", { name: "Exportar" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "JSON" }));
  const busy = screen.getByRole("button", { name: "Exportando…" });
  expect(busy).toBeDisabled();
  await userEvent.click(busy);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => resolve(fileResponse("mis-gastos_2026-11-12.json")));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("button", { name: "Exportar" })).toBeEnabled();
});

it("shows a clear error and retries the same format", async () => {
  fetchMock
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(fileResponse("mis-gastos_2026-11-12.json"));
  renderWithIntl(<ExportButton endpoint="/api/exports/me" />);
  await userEvent.click(screen.getByRole("button", { name: "Exportar" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "JSON" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudo exportar. Revisá tu conexión e intentá de nuevo.",
  );
  expect(save).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenLastCalledWith("/api/exports/me?format=json", { method: "POST" });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("explains a missing account", async () => {
  fetchMock.mockResolvedValueOnce(errorResponse(404, "not_found"));
  renderWithIntl(<ExportButton endpoint="/api/exports/accounts/a1" />, { locale: "en" });
  await userEvent.click(screen.getByRole("button", { name: "Export" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "CSV (spreadsheet)" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "The account no longer exists or you are no longer a member.",
  );
});

it("closes the menu with Escape", async () => {
  renderWithIntl(<ExportButton endpoint="/api/exports/me" />);
  await userEvent.click(screen.getByRole("button", { name: "Exportar" }));
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});
