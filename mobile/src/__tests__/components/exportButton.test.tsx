import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Sharing from "expo-sharing";

import { ExportButton } from "@/components/exports/ExportButton";
import { ApiError } from "@/services/api/types";

import { renderScreen } from "../support/render";

const share = Sharing.shareAsync as jest.Mock;

const file = {
  bytes: new Uint8Array([80, 75]),
  fileName: "chepagame_vacaciones_2026-11-12.zip",
  mimeType: "application/zip",
};

beforeEach(() => jest.clearAllMocks());

it("exports in two taps: Export, then the format, and opens the share sheet (SC-002)", async () => {
  const run = jest.fn(async () => file);
  renderScreen(<ExportButton run={run} />);
  fireEvent.press(screen.getByText("Exportar"));
  fireEvent.press(await screen.findByText("CSV (planilla)"));
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  expect(run).toHaveBeenCalledWith("csv");
  expect(share.mock.calls[0][0]).toBe("file:///cache/exports/chepagame_vacaciones_2026-11-12.zip");
  expect(share.mock.calls[0][1]).toEqual({
    mimeType: "application/zip",
    UTI: "public.zip-archive",
  });
});

it("shows progress and ignores a second tap while exporting (FR-018)", async () => {
  let resolve: (value: typeof file) => void = () => {};
  const run = jest.fn(() => new Promise<typeof file>((r) => (resolve = r)));
  renderScreen(<ExportButton run={run} />);
  fireEvent.press(screen.getByText("Exportar"));
  fireEvent.press(await screen.findByText("JSON"));
  expect(await screen.findByText("Exportando…")).toBeTruthy();
  fireEvent.press(screen.getByText("Exportando…"));
  expect(screen.queryByText("CSV (planilla)")).toBeNull();
  expect(run).toHaveBeenCalledTimes(1);
  await act(async () => resolve(file));
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
});

it("shows a clear error and retries the same format", async () => {
  const run = jest
    .fn()
    .mockRejectedValueOnce(new ApiError(0, "network_error"))
    .mockResolvedValueOnce(file);
  renderScreen(<ExportButton run={run} />);
  fireEvent.press(screen.getByText("Exportar"));
  fireEvent.press(await screen.findByText("JSON"));
  expect(
    await screen.findByText("No se pudo exportar. Revisá tu conexión e intentá de nuevo."),
  ).toBeTruthy();
  expect(share).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("Reintentar"));
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  expect(run).toHaveBeenLastCalledWith("json");
  expect(screen.queryByText("Reintentar")).toBeNull();
});

it("explains a missing account", async () => {
  const run = jest.fn().mockRejectedValue(new ApiError(404, "not_found"));
  renderScreen(<ExportButton run={run} />);
  fireEvent.press(screen.getByText("Exportar"));
  fireEvent.press(await screen.findByText("CSV (planilla)"));
  expect(await screen.findByText("La Cuenta ya no existe o ya no sos miembro.")).toBeTruthy();
});

it("closing the share sheet without choosing is not an error", async () => {
  share.mockResolvedValueOnce(undefined);
  renderScreen(<ExportButton run={jest.fn(async () => file)} />);
  fireEvent.press(screen.getByText("Exportar"));
  fireEvent.press(await screen.findByText("JSON"));
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  expect(screen.queryByText("Reintentar")).toBeNull();
});
