// ViewPicker.tsx — The dropdown in a viewer pane's top corner: what the pane
// shows. Live (the first pane's default; the right-hand pane can't be Live),
// a personal gesture (its newest recording, or the one chosen in the list) or
// a pretrained one — the choices the model's slots offer, with Live in place
// of Unused.

import { STANDARD_GESTURES } from "../data/standardGestures";
import { parseSlotValue, slotValue } from "../lib/modelSlots";
import { useGestureStore, viewSlot, type ViewSource } from "../state/GestureStoreContext";

interface ViewPickerProps {
  index: number;
  source: ViewSource;
  /** "Left"/"Right" when comparing; null for a single pane. */
  side: string | null;
  disabled: boolean;
  className: string;
}

const ViewPicker = ({ index, source, side, disabled, className }: ViewPickerProps) => {
  const { gestureOrder, counts, showInView } = useGestureStore();
  const personal = gestureOrder.filter((name) => counts[name] > 0); // ones with a recording to show

  return (
    <select
      className={className}
      value={slotValue(viewSlot(source) ?? undefined)}
      onChange={(e) => showInView(index, parseSlotValue(e.target.value))}
      disabled={disabled}
      aria-label={side ? `${side} view` : "View"}
      title={
        disabled
          ? "Unavailable while recording"
          : side
            ? "What this side shows (recordings chosen in the list load into the highlighted side)"
            : "What the viewer shows"
      }
    >
      {index === 0 && <option value="">Live</option>}
      {personal.length > 0 && (
        <optgroup label="Personal">
          {personal.map((name) => (
            <option key={name} value={slotValue({ kind: "personal", name })}>
              {name}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="Pretrained">
        {STANDARD_GESTURES.map((g) => (
          <option key={g.id} value={slotValue({ kind: "pretrained", id: g.id })}>
            {g.label}
          </option>
        ))}
      </optgroup>
    </select>
  );
};

export default ViewPicker;
