// modelSlots.ts — The model's gesture slots: up to MODEL_SLOTS gestures, in
// the order the model lists them. Slots are kept packed — the filled ones
// first, the unused ones after them — so a slot set to Unused closes up.
// Each gesture (by its name, the model's key) fills one slot at most.

import type { ModelSlot, Sample, Template } from "../../../types/gestures";
import { STANDARD_GESTURES, templateToSamples } from "../data/standardGestures";

export const MODEL_SLOTS = 6;

// The device's gesture_list starts with its own classes (Idle, Movement),
// then the installed model's gestures.
const DEVICE_CLASSES = 2;

/** The gesture's name in the model. */
export const slotLabel = (slot: ModelSlot) =>
  slot.kind === "personal" ? slot.name : (STANDARD_GESTURES.find((g) => g.id === slot.id)?.label ?? slot.id);

/** A slot as a <select> value ("" is Unused). */
export const slotValue = (slot: ModelSlot | undefined) =>
  !slot ? "" : slot.kind === "personal" ? `personal:${slot.name}` : `pretrained:${slot.id}`;

export function parseSlotValue(value: string): ModelSlot | null {
  const colon = value.indexOf(":");
  const kind = value.slice(0, colon);
  const rest = value.slice(colon + 1);
  if (kind === "personal") return { kind, name: rest };
  if (kind === "pretrained") return { kind, id: rest };
  return null;
}

/** `slots` with slot `index` set to `slot`, or emptied (null) and closed up. */
export function setSlot(slots: ModelSlot[], index: number, slot: ModelSlot | null): ModelSlot[] {
  if (!slot) return slots.filter((_, i) => i !== index);
  const next = [...slots];
  next[Math.min(index, slots.length)] = slot; // an unused slot fills the first free one
  return dedupe(next);
}

/** Slots with each gesture name once (the first wins), at most MODEL_SLOTS. */
function dedupe(slots: ModelSlot[]): ModelSlot[] {
  const seen = new Set<string>();
  return slots
    .filter((slot) => {
      const label = slotLabel(slot);
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    })
    .slice(0, MODEL_SLOTS);
}

/**
 * Saved slots, checked: only well-formed slots for personal gestures that
 * still exist (`personal`) and known pretrained ones, each once.
 */
export function validSlots(saved: unknown, personal: string[]): ModelSlot[] {
  if (!Array.isArray(saved)) return [];
  const names = new Set(personal);
  const ids = new Set(STANDARD_GESTURES.map((g) => g.id));
  return dedupe(
    saved.filter(
      (s): s is ModelSlot =>
        (s?.kind === "personal" && names.has(s.name)) || (s?.kind === "pretrained" && ids.has(s.id)),
    ),
  );
}

/**
 * Slots for the model installed on the device, from its gesture_list: each
 * name a personal gesture's if there is one by that name, else a pretrained
 * gesture's. Names that are neither are left out, and returned in `unknown`.
 */
export function slotsFromDevice(gestureList: string[], personal: string[]) {
  const names = new Set(personal);
  const slots: ModelSlot[] = [];
  const unknown: string[] = [];
  for (const name of gestureList.slice(DEVICE_CLASSES)) {
    const pretrained = STANDARD_GESTURES.find((g) => g.label.toLowerCase() === name.toLowerCase());
    if (names.has(name)) slots.push({ kind: "personal", name });
    else if (pretrained) slots.push({ kind: "pretrained", id: pretrained.id });
    else unknown.push(name);
  }
  return { slots: dedupe(slots), unknown };
}

const sameSamples = (a: Sample[], b: Sample[]) =>
  a.length === b.length &&
  a.every((s, i) => [...s.acc, ...s.gyro].every((v, k) => Math.abs(v - [...b[i].acc, ...b[i].gyro][k]) < 1e-9));

/**
 * Slots for the model read from Cato's drive (one take per class, see
 * readModelFolder), in its order. A class with a pretrained gesture's name and
 * that gesture's template as it ships fills the pretrained slot; every other
 * class is a personal gesture, returned in `personal` to import as its take.
 */
export async function slotsFromCato<T extends { gestureName: string; data: Sample[] }>(
  takes: T[],
  loadPretrained: (id: string) => Promise<Template>,
) {
  const slots: ModelSlot[] = [];
  const personal: T[] = [];
  for (const take of takes) {
    const pretrained = STANDARD_GESTURES.find((g) => g.label.toLowerCase() === take.gestureName.toLowerCase());
    if (pretrained && sameSamples(templateToSamples(await loadPretrained(pretrained.id)), take.data)) {
      slots.push({ kind: "pretrained", id: pretrained.id });
    } else {
      slots.push({ kind: "personal", name: take.gestureName });
      personal.push(take);
    }
  }
  return { slots: dedupe(slots), personal };
}

/** Slots after a personal gesture is deleted (null) or renamed. */
export function renamePersonal(slots: ModelSlot[], oldName: string, newName: string | null): ModelSlot[] {
  const next = slots.flatMap((s) =>
    s.kind === "personal" && s.name === oldName ? (newName ? [{ ...s, name: newName }] : []) : [s],
  );
  return dedupe(next);
}
