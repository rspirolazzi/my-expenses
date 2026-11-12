import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import { fileNameFromDisposition } from "@/utils/fileName";
import { SharingUnavailableError, shareFile } from "@/utils/shareFile";

const files = (FileSystem as unknown as { __files: Map<string, Uint8Array> }).__files;
const share = Sharing.shareAsync as jest.Mock;
const available = Sharing.isAvailableAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  files.clear();
});

it("writes the file to the cache and opens the share sheet", async () => {
  const bytes = new Uint8Array([123, 125]);
  await shareFile(bytes, "mis-gastos_2026-11-12.json", "application/json; charset=utf-8");
  expect(files.get("file:///cache/exports/mis-gastos_2026-11-12.json")).toBe(bytes);
  expect(share).toHaveBeenCalledWith("file:///cache/exports/mis-gastos_2026-11-12.json", {
    mimeType: "application/json",
    UTI: "public.json",
  });
});

it("keeps only the latest export on the device", async () => {
  await shareFile(new Uint8Array([1]), "a.zip", "application/zip");
  await shareFile(new Uint8Array([2]), "b.zip", "application/zip");
  expect([...files.keys()]).toEqual(["file:///cache/exports/b.zip"]);
});

it("fails clearly when the device cannot share", async () => {
  available.mockResolvedValueOnce(false);
  await expect(shareFile(new Uint8Array([1]), "a.zip", "application/zip")).rejects.toBeInstanceOf(
    SharingUnavailableError,
  );
  expect(share).not.toHaveBeenCalled();
});

it("reads the file name from Content-Disposition", () => {
  expect(
    fileNameFromDisposition(
      "attachment; filename=\"a.zip\"; filename*=UTF-8''mis-gastos_a%C3%B1o_2026-11-12.zip",
      "x",
    ),
  ).toBe("mis-gastos_año_2026-11-12.zip");
  expect(fileNameFromDisposition('attachment; filename="b.json"', "x")).toBe("b.json");
  expect(fileNameFromDisposition(null, "export.zip")).toBe("export.zip");
});
