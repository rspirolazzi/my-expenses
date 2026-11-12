import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, HelperText, Menu } from "react-native-paper";

import type { DownloadedFile } from "../../services/api/client";
import type { ExportFormat } from "../../services/api/exports";
import { errorCodeOf } from "../../services/api/types";
import { shareFile } from "../../utils/shareFile";

const FORMATS: ExportFormat[] = ["csv", "json"];

interface ExportButtonProps {
  /** Downloads the file in the chosen format (one account or all my data). */
  run: (format: ExportFormat) => Promise<DownloadedFile>;
  label?: string;
}

/**
 * "Export" menu with CSV and JSON. Shows progress, ignores a second tap while exporting, and
 * offers retry after an error (FR-018). The file opens in the system share sheet (FR-017).
 */
export function ExportButton({ run, label }: ExportButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{ format: ExportFormat; notFound: boolean } | null>(null);
  const running = useRef(false);

  async function exportAs(format: ExportFormat) {
    if (running.current) return;
    running.current = true;
    setOpen(false);
    setFailed(null);
    setBusy(true);
    try {
      const file = await run(format);
      await shareFile(file.bytes, file.fileName, file.mimeType);
    } catch (err) {
      setFailed({ format, notFound: errorCodeOf(err) === "not_found" });
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Menu
        visible={open}
        onDismiss={() => setOpen(false)}
        anchor={
          <Button
            mode="outlined"
            icon="export-variant"
            loading={busy}
            disabled={busy}
            onPress={() => setOpen(true)}
          >
            {busy ? t("exports.exporting") : (label ?? t("exports.button"))}
          </Button>
        }
      >
        {FORMATS.map((format) => (
          <Menu.Item key={format} title={t(`exports.${format}`)} onPress={() => exportAs(format)} />
        ))}
      </Menu>
      {failed && (
        <View>
          <HelperText type="error" visible accessibilityRole="alert">
            {failed.notFound ? t("exports.notFound") : t("exports.error")}
          </HelperText>
          <Button mode="text" onPress={() => exportAs(failed.format)}>
            {t("exports.retry")}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: "flex-start" },
});
