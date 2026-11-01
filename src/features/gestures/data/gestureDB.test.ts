import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { Sample } from "../../../types/gestures";
import {
  addRecordings,
  deleteGesture,
  deleteRecording,
  getAllRecordings,
  getGestureClasses,
  getGestureOrder,
  getGestureCounts,
  getModelSlots,
  getSlotsFromDevice,
  getRecordingsForGesture,
  renameGesture,
  saveGestureOrder,
  saveModelSlots,
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

  it("reports each class's first recording, so classes can be listed in creation order", async () => {
    const first = await saveRecording("order-z", samples);
    await saveRecording("order-a", samples);
    await saveRecording("order-z", samples);
    const classes = (await getGestureClasses()).filter((c) => c.name.startsWith("order-"));
    const z = classes.find((c) => c.name === "order-z")!;
    const a = classes.find((c) => c.name === "order-a")!;
    expect(z).toEqual({ name: "order-z", count: 2, firstId: first });
    expect(a.firstId).toBeGreaterThan(z.firstId);
  });

  it("saves the gesture order", async () => {
    expect(await getGestureOrder()).toEqual([]);
    await saveGestureOrder(["b", "a"]);
    expect(await getGestureOrder()).toEqual(["b", "a"]);
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

  it("saves the model's slots", async () => {
    expect(await getModelSlots()).toEqual([]);
    await saveModelSlots([{ kind: "personal", name: "nod" }, { kind: "pretrained", id: "tilt_left" }]);
    expect(await getModelSlots()).toEqual([{ kind: "personal", name: "nod" }, { kind: "pretrained", id: "tilt_left" }]);
    expect(await getSlotsFromDevice()).toEqual([]);
    await saveModelSlots([], ["Idle", "Movement"]);
    expect(await getSlotsFromDevice()).toEqual(["Idle", "Movement"]);
  });
});
