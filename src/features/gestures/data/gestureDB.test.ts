import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { Sample } from "../../../types/gestures";
import {
  addRecordings,
  deleteGesture,
  deleteModel,
  deleteRecording,
  getAllModels,
  getAllRecordings,
  getGestureCounts,
  getRecordingsForGesture,
  renameGesture,
  saveModel,
  saveRecording,
} from "./gestureDB";

const samples: Sample[] = [{ ts: 0, acc: [0, 0, 9.8], gyro: [0, 0, 0] }];

// One shared database for the file, so each test works on its own names.
describe("gestureDB", () => {
  it("counts recordings per class", async () => {
    await saveRecording("count-a", samples);
    await saveRecording("count-a", samples);
    await saveRecording("count-b", samples);
    const counts = await getGestureCounts();
    expect(counts["count-a"]).toBe(2);
    expect(counts["count-b"]).toBe(1);
  });

  it("adds recordings with their own timestamps", async () => {
    const timestamp = "2026-01-02T03:04:05.000Z";
    await addRecordings([
      { gestureName: "import-a", timestamp, data: samples },
      { gestureName: "import-b", timestamp, data: samples },
    ]);
    const added = (await getAllRecordings()).filter((r) => r.gestureName.startsWith("import-"));
    expect(added.map((r) => [r.gestureName, r.timestamp])).toEqual([
      ["import-a", timestamp],
      ["import-b", timestamp],
    ]);
  });

  it("renaming onto an existing class merges them", async () => {
    await saveRecording("merge-from", samples);
    await saveRecording("merge-to", samples);
    await renameGesture("merge-from", "merge-to");
    expect(await getRecordingsForGesture("merge-from")).toHaveLength(0);
    expect(await getRecordingsForGesture("merge-to")).toHaveLength(2);
  });

  it("deletes one recording or a whole class", async () => {
    const id = await saveRecording("del", samples);
    await saveRecording("del", samples);
    await deleteRecording(id);
    expect(await getRecordingsForGesture("del")).toHaveLength(1);
    await deleteGesture("del");
    expect((await getGestureCounts())["del"]).toBeUndefined();
  });

  it("saves, lists and deletes models", async () => {
    const template = { acc_x: [1], acc_y: [1], acc_z: [1], gyro_x: [1], gyro_y: [1], gyro_z: [1] };
    const model = await saveModel("m", { nod: { template, keptCount: 1, totalCount: 1 } });
    expect((await getAllModels()).map((m) => m.id)).toContain(model.id);
    await deleteModel(model.id);
    expect((await getAllModels()).map((m) => m.id)).not.toContain(model.id);
  });
});
