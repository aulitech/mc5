// configFile.ts — Backup/restore of the device config as a local JSON file.

import type { Config } from "../types/config";
import { notify } from "./notify";

const JSON_TYPES: FilePickerAcceptType[] = [
  { description: "JSON Files", accept: { "application/json": [".json"] } },
];

const isAbort = (err: unknown) => err instanceof DOMException && err.name === "AbortError";

/**
 * Let the user pick a config JSON file and return its parsed contents
 * (unvalidated — replaceConfig checks the shape). Resolves null if they cancel.
 */
export async function openConfigFile(): Promise<unknown> {
  try {
    const [handle] = await window.showOpenFilePicker({ types: JSON_TYPES, multiple: false });
    const file = await handle.getFile();
    return JSON.parse(await file.text());
  } catch (err) {
    if (isAbort(err)) return null;
    if (err instanceof SyntaxError) throw new Error("That file isn't valid JSON.");
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

/** Save `blob` via the save picker. Resolves false if the user cancels. */
export async function saveWithPicker(
  blob: Blob,
  suggestedName: string,
  types: FilePickerAcceptType[],
): Promise<boolean> {
  try {
    const handle = await window.showSaveFilePicker({ suggestedName, types });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (err) {
    if (isAbort(err)) return false;
    throw err;
  }
}

/** Trigger a browser download of `blob` (fallback when there's no save picker). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Save the config as JSON via the save picker (or a download fallback). */
export async function saveConfigFile(config: Config): Promise<void> {
  const filename = backupFilename(config);
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });

  if ("showSaveFilePicker" in window) {
    await saveWithPicker(blob, filename, JSON_TYPES);
    return;
  }
  downloadBlob(blob, filename);
  notify.info("Configuration saved in Downloads folder.");
}
