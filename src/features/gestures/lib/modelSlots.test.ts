import { describe, expect, it } from "vitest";
import type { ModelSlot, Template } from "../../../types/gestures";
import { templateToSamples } from "../data/standardGestures";
import {
  parseSlotValue,
  renamePersonal,
  setSlot,
  slotLabel,
  slotValue,
  slotsFromCato,
  slotsFromDevice,
  validSlots,
} from "./modelSlots";

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

describe("slotsFromCato", () => {
  const template = (seed: number) =>
    Object.fromEntries(
      ["acc_x", "acc_y", "acc_z", "gyro_x", "gyro_y", "gyro_z"].map((c, k) => [
        c,
        Array.from({ length: 100 }, (_, t) => seed + k + t / 100),
      ]),
    ) as Template;
  // Each pretrained gesture's shipped template.
  const shipped: Record<string, Template> = { nod_up: template(1), tilt_left: template(2) };
  const load = async (id: string) => shipped[id] ?? template(99);
  const take = (gestureName: string, t: Template) => ({ gestureName, data: templateToSamples(t) });

  it("slots Cato's classes in order, pretrained ones as shipped, the rest personal", async () => {
    const takes = [
      take("cw", template(5)),
      take("Nod Up", template(1)), // as shipped
      take("tilt left", template(2)), // as shipped, any case
      take("Nod Down", template(6)), // a pretrained name, but recorded here
    ];
    const { slots, personal } = await slotsFromCato(takes, load);
    expect(slots).toEqual([
      { kind: "personal", name: "cw" },
      { kind: "pretrained", id: "nod_up" },
      { kind: "pretrained", id: "tilt_left" },
      { kind: "personal", name: "Nod Down" },
    ]);
    expect(personal.map((t) => t.gestureName)).toEqual(["cw", "Nod Down"]);
  });

  it("fills at most MODEL_SLOTS", async () => {
    const takes = Array.from({ length: 8 }, (_, i) => take(`g${i}`, template(i + 10)));
    const { slots, personal } = await slotsFromCato(takes, load);
    expect(slots.map(slotLabel)).toEqual(["g0", "g1", "g2", "g3", "g4", "g5"]);
    expect(personal).toHaveLength(8);
  });
});
