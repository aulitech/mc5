// ViewTemplate.tsx — The graph under a viewer pane: the template of the
// gesture the pane shows (a personal one's built from all its recordings,
// rebuilt as they're added or deleted; a pretrained one's as it ships).
// Nothing for Live.

import { useMemo } from "react";
import { useSlotTemplates } from "../hooks/useSlotTemplates";
import { parseSlotValue, slotValue } from "../lib/modelSlots";
import { useGestureStore, viewSlot, type ViewSource } from "../state/GestureStoreContext";
import GestureTemplateChart from "./GestureTemplateChart";
import styles from "../GestureTab.module.css";

interface ViewTemplateProps {
  source: ViewSource;
  /** The pane's width, which the graph matches. */
  width: number;
}

const ViewTemplate = ({ source, width }: ViewTemplateProps) => {
  const { counts } = useGestureStore();
  // Keyed by the gesture, so choosing another recording of it doesn't rebuild.
  const key = slotValue(viewSlot(source) ?? undefined);
  const slots = useMemo(() => {
    const slot = parseSlotValue(key);
    return slot ? [slot] : [];
  }, [key]);
  const [shown] = useSlotTemplates(slots, counts, true);
  if (slots.length === 0 || !shown) return null;

  return (
    <div className={styles.viewTemplate} style={{ width }}>
      {shown.template ? (
        <GestureTemplateChart template={shown.template} gestureName={shown.label} width={width} />
      ) : (
        <p className={styles.emptyMsg}>
          No {shown.label} template yet: recordings need the whole gesture inside the capture window.
        </p>
      )}
    </div>
  );
};

export default ViewTemplate;
