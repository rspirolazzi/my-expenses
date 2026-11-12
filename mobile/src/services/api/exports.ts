import { type DownloadedFile, requestFile } from "./client";

export type ExportFormat = "csv" | "json";

function fallbackName(format: ExportFormat) {
  return `export.${format === "csv" ? "zip" : "json"}`;
}

/** Feature 005: the backend builds the file; the app only saves or shares it. */
export const exportsApi = {
  account: (accountId: string, format: ExportFormat): Promise<DownloadedFile> =>
    requestFile(
      `/accounts/${encodeURIComponent(accountId)}/export?format=${format}`,
      fallbackName(format),
    ),
  mine: (format: ExportFormat): Promise<DownloadedFile> =>
    requestFile(`/users/me/export?format=${format}`, fallbackName(format)),
};
