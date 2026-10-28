// configFile.ts — Backup/restore of the device config as a local JSON file.

import type { Config } from "../types/config";
import { notify } from "./notify";

const JSON_TYPES: FilePickerAcceptType[] = [
  { description: "JSON Files", accept: { "application/json": [".json"] } },
];

const isAbort = (err: unknown) => err instanceof DOMException && err.name === "AbortError";

/** Let the user pick a config JSON file. Resolves null if they cancel. */
export async function openConfigFile(): Promise<Config | null> {
  try {
    const [handle] = await window.showOpenFilePicker({ types: JSON_TYPES, multiple: false });
    const file = await handle.getFile();
    return JSON.parse(await file.text()) as Config;
  } catch (err) {
    if (isAbort(err)) return null;
    throw err;
  }
}

// e.g. "Living_Room_Cato_20261028-1517.json"
function backupFilename(config: Config) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const deviceName =
    config.global_info?.name || "Cato_".concat(config.global_info?.HW_UID?.slice(-4) ?? "");
  const safeDeviceName = deviceName.replace(/[^a-z0-9._' -]/gi, "_");
  return `${safeDeviceName}_${timestamp}.json`;
}

/** Save the config as JSON via the save picker (or a download fallback). */
export async function saveConfigFile(config: Config): Promise<void> {
  const filename = backupFilename(config);
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });

  if ("showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: filename, types: JSON_TYPES });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (err) {
      if (!isAbort(err)) throw err;
    }
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  notify.info("Configuration saved in Downloads folder.");
}
