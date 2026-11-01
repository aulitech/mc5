// catoDrive.ts — Writing the model to Cato's USB drive (File System Access API).
//
// Connected by USB, Cato shows up as a drive. The first install asks the user
// to choose it, with read/write access; the handle is kept in IndexedDB, so
// later installs only need the browser's permission again (Chrome can keep
// that too, if the user picks "Allow on every visit"). Choosing again happens
// only if access is refused or the remembered drive isn't connected.
//
// Picking and permission prompts need a user gesture, so call openCatoDrive
// straight from a click, before any slow work.

import { getCatoDrive, saveCatoDrive } from "./gestureDB";

export const MODEL_FOLDER = "xcorr_model";

/** The browser can write to a chosen folder (Chromium browsers). */
export const canWriteToDrive = () => "showDirectoryPicker" in window;

const READ_WRITE = { mode: "readwrite" } as const;

const isAbort = (err: unknown) => err instanceof DOMException && err.name === "AbortError";

// Read/write access to a remembered drive, asking again if needed, and the
// drive is there (connected) — else false.
async function canUse(drive: FileSystemDirectoryHandle) {
  let state = await drive.queryPermission(READ_WRITE);
  if (state === "prompt") state = await drive.requestPermission(READ_WRITE);
  if (state !== "granted") return false;
  try {
    await drive.keys().next(); // fails if the drive isn't connected
    return true;
  } catch {
    return false;
  }
}

/**
 * Cato's drive, with read/write access: the remembered one, else one the user
 * chooses (then remembered). Null if they cancel choosing.
 */
export async function openCatoDrive(): Promise<FileSystemDirectoryHandle | null> {
  const saved = await getCatoDrive().catch(() => null);
  if (saved && (await canUse(saved))) return saved;
  try {
    const drive = await window.showDirectoryPicker({ id: "cato-drive", mode: "readwrite", startIn: "desktop" });
    await saveCatoDrive(drive).catch((err) => console.error("Gestures: couldn't remember the Cato drive", err));
    return drive;
  } catch (err) {
    if (isAbort(err)) return null;
    throw err;
  }
}

/**
 * Write the model files to the drive's xcorr_model folder (created if
 * needed), replacing the model there: template files the new model doesn't
 * have are removed.
 */
export async function writeModelFolder(drive: FileSystemDirectoryHandle, files: [string, string][]) {
  const folder = await drive.getDirectoryHandle(MODEL_FOLDER, { create: true });
  for (const [name, contents] of files) {
    const file = await folder.getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    await writable.write(contents);
    await writable.close();
  }
  const names = new Set(files.map(([name]) => name));
  const stale: string[] = [];
  for await (const name of folder.keys()) {
    if (/^model_templates_\d+\.csv$/.test(name) && !names.has(name)) stale.push(name);
  }
  for (const name of stale) await folder.removeEntry(name);
}
