// catoDrive.ts — The model on Cato's USB drive (File System Access API):
// writing it (Install) and reading it back (import from Cato).
//
// Connected by USB, Cato shows up as a drive. The first install asks the user
// to choose it, with read/write access; the handle is kept in IndexedDB, so
// later installs only need the browser's permission again (Chrome can keep
// that too, if the user picks "Allow on every visit"). Choosing again happens
// only if access is refused or the remembered drive isn't connected, or when
// the user changes it (Install's dialog shows which drive it is).
//
// Picking and permission prompts need a user gesture, so call openCatoDrive
// straight from a click, before any slow work.

import type { RecordingData } from "../lib/recordingFile";
import { parseModelFiles } from "../lib/templateGen";
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
 * Cato's drive, with read/write access: `drive` if given, else the remembered
 * one, else one the user chooses (then remembered). Null if they cancel
 * choosing.
 */
export async function openCatoDrive(
  drive?: FileSystemDirectoryHandle | null,
): Promise<FileSystemDirectoryHandle | null> {
  const saved = drive ?? (await rememberedCatoDrive());
  if (saved && (await canUse(saved))) return saved;
  return chooseCatoDrive();
}

/** The remembered drive, without asking for access; null if none is. */
export const rememberedCatoDrive = () => getCatoDrive().catch(() => null);

/**
 * Ask the user to choose Cato's drive, with read/write access, and remember
 * it in place of any chosen before. Null if they cancel.
 */
export async function chooseCatoDrive(): Promise<FileSystemDirectoryHandle | null> {
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

const isNotFound = (err: unknown) => err instanceof DOMException && err.name === "NotFoundError";

/**
 * The model in the drive's xcorr_model folder, one take per class (see
 * parseModelFiles), timed by when its template file was written, so reading
 * the same install again gives the same takes.
 *
 * @throws Error with a readable message if the drive has no model
 */
export async function readModelFolder(drive: FileSystemDirectoryHandle): Promise<RecordingData[]> {
  const read = async (folder: FileSystemDirectoryHandle, name: string) => (await folder.getFileHandle(name)).getFile();
  let folder: FileSystemDirectoryHandle;
  let params: File;
  try {
    folder = await drive.getDirectoryHandle(MODEL_FOLDER);
    params = await read(folder, "model_params.csv");
  } catch (err) {
    if (isNotFound(err)) throw new Error(`There's no model on ${drive.name}: it has no ${MODEL_FOLDER} folder with a model_params.csv.`);
    throw err;
  }
  const times: string[] = [];
  const takes = await parseModelFiles(await params.text(), async (i) => {
    const name = `model_templates_${i}.csv`;
    try {
      const file = await read(folder, name);
      times[i] = new Date(file.lastModified).toISOString();
      return await file.text();
    } catch (err) {
      if (isNotFound(err)) throw new Error(`The model on ${drive.name} is missing ${name}.`);
      throw err;
    }
  });
  return takes.map((take, i) => ({ ...take, timestamp: times[i] }));
}
