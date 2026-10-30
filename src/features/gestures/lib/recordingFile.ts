// recordingFile.ts — Export/import of gesture recordings as JSON files, so
// they can be backed up or moved to another browser or computer.
//
// File format:
//   { "format": "mycato-gesture-recordings", "version": 1, "exportedAt": ISO,
//     "recordings": [{ "gestureName", "timestamp", "data": Sample[] }] }
// Database ids aren't exported.

import { downloadBlob, saveWithPicker } from "../../../lib/configFile";
import { notify } from "../../../lib/notify";
import type { Recording, Sample, Triple } from "../../../types/gestures";
import { getAllRecordings } from "../data/gestureDB";

export const RECORDING_FILE_FORMAT = "mycato-gesture-recordings";
export const RECORDING_FILE_VERSION = 1;

/** A recording as stored in a file: everything but its database id. */
export type RecordingData = Omit<Recording, "id">;

const RECORDING_FILE_TYPES: FilePickerAcceptType[] = [
  { description: "MyCato gesture recordings", accept: { "application/json": [".json"] } },
];

export function serializeRecordings(recordings: RecordingData[]): string {
  // No indentation: a file holds thousands of samples.
  return JSON.stringify({
    format: RECORDING_FILE_FORMAT,
    version: RECORDING_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    recordings: recordings.map(({ gestureName, timestamp, data }) => ({ gestureName, timestamp, data })),
  });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTriple = (value: unknown): value is Triple =>
  Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

function parseSample(value: unknown): Sample | null {
  if (!isRecord(value) || !isTriple(value.acc) || !isTriple(value.gyro)) return null;
  const sample: Sample = { acc: value.acc, gyro: value.gyro };
  if (Number.isFinite(value.ts)) sample.ts = value.ts as number;
  return sample;
}

function parseRecording(value: unknown, index: number): RecordingData {
  const where = `Recording ${index + 1}`;
  if (!isRecord(value)) throw new Error(`${where} isn't an object.`);
  const { gestureName, timestamp, data } = value;
  if (typeof gestureName !== "string" || gestureName.trim() === "") throw new Error(`${where} has no gesture name.`);
  if (!Array.isArray(data) || data.length === 0) throw new Error(`${where} ("${gestureName}") has no samples.`);
  const samples = data.map(parseSample);
  const bad = samples.indexOf(null);
  if (bad >= 0) throw new Error(`${where} ("${gestureName}"): sample ${bad + 1} needs acc and gyro as 3 numbers each.`);
  return {
    gestureName: gestureName.trim(),
    timestamp: typeof timestamp === "string" && !Number.isNaN(Date.parse(timestamp)) ? timestamp : new Date().toISOString(),
    data: samples as Sample[],
  };
}

/** Validate a parsed recordings file. Throws an Error with a readable message if it isn't one. */
export function parseRecordingFile(value: unknown): RecordingData[] {
  if (!isRecord(value) || value.format !== RECORDING_FILE_FORMAT) {
    throw new Error("That isn't a MyCato gesture recordings file.");
  }
  if (value.version !== RECORDING_FILE_VERSION) {
    throw new Error(`Unsupported recordings file version (${String(value.version)}). Update MyCato and try again.`);
  }
  if (!Array.isArray(value.recordings)) throw new Error("The file has no recordings.");
  return value.recordings.map(parseRecording);
}

/** Identifies a recording across exports: the same take always has the same class and timestamp. */
export const recordingKey = (r: Pick<Recording, "gestureName" | "timestamp">) => `${r.gestureName}\u0000${r.timestamp}`;

function timestamp() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/**
 * Save every stored recording to one JSON file via the save picker (or a
 * download fallback). Resolves false if the user cancels.
 */
export async function exportRecordings(): Promise<boolean> {
  const recordings = await getAllRecordings();
  const filename = `gesture_recordings_${timestamp()}.json`;
  const blob = new Blob([serializeRecordings(recordings)], { type: "application/json" });

  if ("showSaveFilePicker" in window) return saveWithPicker(blob, filename, RECORDING_FILE_TYPES);
  downloadBlob(blob, filename);
  notify.info("Recordings saved in Downloads folder.");
  return true;
}

/**
 * Let the user pick one or more recordings files and return their recordings.
 * Resolves [] if they cancel; throws (naming the file) if one is invalid.
 */
export async function openRecordingFiles(): Promise<RecordingData[]> {
  let handles: FileSystemFileHandle[];
  try {
    handles = await window.showOpenFilePicker({ types: RECORDING_FILE_TYPES, multiple: true });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return [];
    throw err;
  }
  const recordings: RecordingData[] = [];
  for (const handle of handles) {
    const file = await handle.getFile();
    try {
      recordings.push(...parseRecordingFile(JSON.parse(await file.text())));
    } catch (err) {
      const reason = err instanceof SyntaxError ? "it isn't valid JSON." : (err as Error).message;
      throw new Error(`Couldn't read ${file.name}: ${reason}`, { cause: err });
    }
  }
  return recordings;
}
