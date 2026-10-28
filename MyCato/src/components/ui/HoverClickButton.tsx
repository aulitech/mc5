import { useEffect, useRef } from "react";
import ota from "../../device/ota";
import { errorMessage, notify } from "../../lib/notify";

// Hovering for this long clicks the button, so it can be operated with Cato's
// pointer alone (no click gesture needed).
const HOVER_CLICK_MS = 1200;
// Ignore repeat clicks within this window.
const DEBOUNCE_MS = 1500;

interface HoverClickButtonProps {
  /** Device trigger command, e.g. "dwell_click" or "sleep". */
  command: string;
  label: string;
  title: string;
  active?: boolean;
}

const HoverClickButton = ({ command, label, title, active = false }: HoverClickButtonProps) => {
  const lastFiredRef = useRef(0);
  const hoverTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => clearTimeout(hoverTimerRef.current), []);

  const fire = async () => {
    const now = Date.now();
    if (now - lastFiredRef.current < DEBOUNCE_MS) return;
    lastFiredRef.current = now;
    try {
      await ota.send(`trigger ${JSON.stringify({ command })}`);
    } catch (err) {
      console.error(`Error triggering ${command}:`, err);
      notify.error(`Couldn't trigger ${title.toLowerCase()}: ${errorMessage(err)}`);
    }
  };

  return (
    <button
      className={`indicator ${active ? "active" : ""}`}
      title={title}
      onClick={fire}
      onMouseEnter={() => {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = window.setTimeout(fire, HOVER_CLICK_MS);
      }}
      onMouseLeave={() => clearTimeout(hoverTimerRef.current)}
    >
      {label}
    </button>
  );
};

export default HoverClickButton;
