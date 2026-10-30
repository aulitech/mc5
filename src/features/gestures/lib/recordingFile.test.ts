import { describe, expect, it } from "vitest";
import { RECORDING_FILE_FORMAT, parseRecordingFile, recordingKey, serializeRecordings, type RecordingData } from "./recordingFile";

const recording = (gestureName: string): RecordingData => ({
  gestureName,
  timestamp: "2026-10-01T12:00:00.000Z",
  data: [
    { ts: 0, acc: [0, 0, 9.8], gyro: [1, 2, 3] },
    { ts: 10, acc: [0.1, 0, 9.7], gyro: [1, 2, 4] },
  ],
});

const fileWith = (recordings: unknown) => ({ format: RECORDING_FILE_FORMAT, version: 1, recordings });

describe("recording files", () => {
  it("round-trips recordings", () => {
    const recordings = [recording("Wave"), recording("Nod")];
    expect(parseRecordingFile(JSON.parse(serializeRecordings(recordings)))).toEqual(recordings);
  });

  it("doesn't export database ids", () => {
    const json = JSON.parse(serializeRecordings([{ ...recording("Wave"), id: 7 } as RecordingData]));
    expect(json.recordings[0]).not.toHaveProperty("id");
  });

  it("rejects other files", () => {
    expect(() => parseRecordingFile({ format: "mycato-gesture-models", version: 1 })).toThrow(
      "isn't a MyCato gesture recordings file",
    );
    expect(() => parseRecordingFile({ ...fileWith([]), version: 2 })).toThrow("Unsupported recordings file version");
  });

  it("rejects bad recordings", () => {
    expect(() => parseRecordingFile(fileWith([{ ...recording("Wave"), gestureName: " " }]))).toThrow("has no gesture name");
    expect(() => parseRecordingFile(fileWith([{ ...recording("Wave"), data: [] }]))).toThrow("has no samples");
    const bad = recording("Wave");
    (bad.data[1] as unknown as { gyro: unknown }).gyro = [1, 2];
    expect(() => parseRecordingFile(fileWith([bad]))).toThrow("sample 2 needs acc and gyro");
  });

  it("fills in a missing timestamp and drops a bad sample time", () => {
    const rec = { ...recording("Wave"), timestamp: undefined, data: [{ ts: "x", acc: [0, 0, 1], gyro: [0, 0, 0] }] };
    const [parsed] = parseRecordingFile(fileWith([rec]));
    expect(Number.isNaN(Date.parse(parsed.timestamp))).toBe(false);
    expect(parsed.data[0]).toEqual({ acc: [0, 0, 1], gyro: [0, 0, 0] });
  });

  it("keys a recording by class and timestamp", () => {
    const other = { ...recording("Wave"), data: [] }; // same take, different samples
    expect(recordingKey(recording("Wave"))).toBe(recordingKey(other));
    expect(recordingKey(recording("Wave"))).not.toBe(recordingKey(recording("Nod")));
  });
});
