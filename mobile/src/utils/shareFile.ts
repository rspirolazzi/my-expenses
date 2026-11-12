import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

const UTIS: Record<string, string> = {
  "application/zip": "public.zip-archive",
  "application/json": "public.json",
};

export class SharingUnavailableError extends Error {
  constructor() {
    super("sharing_unavailable");
    this.name = "SharingUnavailableError";
  }
}

/**
 * Writes the export to the app cache and opens the system share sheet (FR-017, research R13).
 * The previous export is deleted first, so at most one file stays on the device. Closing the
 * sheet without choosing is not an error.
 */
export async function shareFile(bytes: Uint8Array, fileName: string, mimeType: string) {
  if (!(await Sharing.isAvailableAsync())) throw new SharingUnavailableError();
  const folder = new Directory(Paths.cache, "exports");
  if (folder.exists) folder.delete();
  folder.create({ intermediates: true });
  const file = new File(folder, fileName);
  file.write(bytes);
  const baseType = mimeType.split(";")[0].trim();
  await Sharing.shareAsync(file.uri, { mimeType: baseType, UTI: UTIS[baseType] });
}
