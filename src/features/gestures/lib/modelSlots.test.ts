import { describe, expect, it } from "vitest";
import type { ModelSlot } from "../../../types/gestures";
import { parseSlotValue, renamePersonal, setSlot, slotLabel, slotValue, slotsFromDevice, validSlots } from "./modelSlots";

const wave: ModelSlot = { kind: "personal", name: "Wave" };
const shake: ModelSlot = { kind: "personal", name: "Shake" };
const tiltLeft: ModelSlot = { kind: "pretrained", id: "tilt_left" };

describe("model slots", () => {
  it("names pretrained gestures by their label", () => {
    expect(slotLabel(tiltLeft)).toBe("Tilt Left");
    expect(slotLabel(wave)).toBe("Wave");
  });

  it("round-trips select values", () => {
    for (const slot of [wave, tiltLeft, { kind: "personal", name: "a:b" } as const]) {
      expect(parseSlotValue(slotValue(slot))).toEqual(slot);
    }
    expect(slotValue(undefined)).toBe("");
    expect(parseSlotValue("")).toBeNull();
  });

  it("fills the first free slot and closes up an unused one", () => {
    expect(setSlot([wave], 4, tiltLeft)).toEqual([wave, tiltLeft]);
    expect(setSlot([wave, tiltLeft], 0, shake)).toEqual([shake, tiltLeft]);
    expect(setSlot([wave, shake, tiltLeft], 1, null)).toEqual([wave, tiltLeft]);
  });

  it("keeps each gesture name in one slot", () => {
    expect(setSlot([wave, shake], 1, wave)).toEqual([wave]);
    // A personal gesture named like a pretrained one clashes with it.
    expect(setSlot([tiltLeft], 1, { kind: "personal", name: "Tilt Left" })).toEqual([tiltLeft]);
  });

  it("checks saved slots against the gestures that exist", () => {
    const saved = [wave, { kind: "personal", name: "Gone" }, tiltLeft, { kind: "pretrained", id: "nope" }, 7, wave];
    expect(validSlots(saved, ["Wave"])).toEqual([wave, tiltLeft]);
    expect(validSlots("junk", ["Wave"])).toEqual([]);
  });

  it("fills from the device's gesture list, after its own two classes", () => {
    expect(slotsFromDevice(["Idle", "Movement", "Wave", "Tilt Left", "nod up", "Mystery"], ["Wave"])).toEqual({
      slots: [wave, tiltLeft, { kind: "pretrained", id: "nod_up" }],
      unknown: ["Mystery"],
    });
    // A personal gesture wins over a pretrained one with the same name.
    expect(slotsFromDevice(["Idle", "Movement", "Tilt Left"], ["Tilt Left"]).slots).toEqual([
      { kind: "personal", name: "Tilt Left" },
    ]);
    expect(slotsFromDevice([], ["Wave"]).slots).toEqual([]);
  });

  it("follows a renamed or deleted personal gesture", () => {
    expect(renamePersonal([wave, tiltLeft], "Wave", "Hello")).toEqual([{ kind: "personal", name: "Hello" }, tiltLeft]);
    expect(renamePersonal([wave, shake, tiltLeft], "Wave", null)).toEqual([shake, tiltLeft]);
    expect(renamePersonal([wave, shake], "Wave", "Shake")).toEqual([shake]); // merged
  });
});
