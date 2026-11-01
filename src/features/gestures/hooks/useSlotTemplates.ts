// useSlotTemplates.ts — Templates for graphing, one per slot-style gesture
// (see ViewTemplate): rebuilt whenever the gestures change or a recording is
// added or removed, but only while `enabled`. The previous templates stay
// until the new ones are ready, so the graphs don't flicker.

import { useEffect, useState } from "react";
import type { ModelSlot, Template } from "../../../types/gestures";
import { loadSlotTemplate } from "../data/slotTemplates";
import { slotLabel } from "../lib/modelSlots";

export interface SlotTemplate {
  label: string;
  /** null if the slot's recordings don't give a template. */
  template: Template | null;
}

/**
 * @param recordingCounts - Recordings per gesture; a new value means the
 *   recordings changed, so the templates are rebuilt.
 */
export function useSlotTemplates(slots: ModelSlot[], recordingCounts: unknown, enabled: boolean): SlotTemplate[] {
  const [templates, setTemplates] = useState<SlotTemplate[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.all(
      slots.map(async (slot) => {
        const label = slotLabel(slot);
        try {
          return { label, template: await loadSlotTemplate(slot) };
        } catch (err) {
          console.error(`Gestures: couldn't build the template for "${label}"`, err);
          return { label, template: null };
        }
      }),
    ).then((next) => {
      if (!cancelled) setTemplates(next);
    });
    return () => {
      cancelled = true;
    };
  }, [slots, recordingCounts, enabled]);

  return templates;
}
