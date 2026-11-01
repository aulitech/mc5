// slotTemplates.ts — The template for one of the model's slots: a personal
// gesture's built from its recordings, a pretrained gesture's as it ships.
// Used to build the model and to chart it.

import type { ModelSlot, Template } from "../../../types/gestures";
import { buildGestureTemplate } from "../lib/templateGen";
import { getRecordingsForGesture } from "./gestureDB";
import { loadStandardGestureTemplate } from "./standardGestures";

/** The slot's template, or null if its recordings don't give one. */
export async function loadSlotTemplate(slot: ModelSlot): Promise<Template | null> {
  if (slot.kind === "pretrained") return loadStandardGestureTemplate(slot.id);
  const recs = await getRecordingsForGesture(slot.name);
  return buildGestureTemplate(recs.map((r) => r.data)).template;
}
