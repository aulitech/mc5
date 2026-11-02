// NumberSpinner.tsx — A number box with up/down buttons. Typed text is
// committed on Enter or blur (Escape drops it), so a half-typed value (e.g.
// "0." or the "1" of "150") is never sent; the buttons commit a step at once.
// Committed values are rounded to the step and clamped to the range.

import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { clampToRange, parseNumber, type NumberRange } from "../../lib/leafValue";

interface NumberSpinnerProps {
  value: number;
  range: NumberRange;
  /** Accessible name of the box; the buttons are "Increase …"/"Decrease …". */
  label: string;
  onCommit: (value: number) => void;
  /** Width of the text box (default 5rem). */
  width?: string;
}

const NumberSpinner = ({ value, range, label, onCommit, width = "5rem" }: NumberSpinnerProps) => {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (n: number) => onCommit(clampToRange(n, range));
  const commitDraft = () => {
    const n = draft === null ? null : parseNumber(draft);
    setDraft(null);
    if (n !== null && n !== value) commit(n);
  };

  return (
    <div className="custom-spinner-wrapper" style={{ minWidth: "fit-content", margin: 0 }}>
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        className="input-base spinner-input input-number-no-spin"
        style={{
          fontSize: "smaller",
          minWidth: "1rem",
          width,
          textAlign: "right",
          background: "transparent",
          border: "none",
          outline: "none",
        }}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitDraft();
          if (e.key === "Escape") setDraft(null);
        }}
      />
      <div className="spinner-btns">
        <button
          type="button"
          className="btn-spin"
          aria-label={`Increase ${label}`}
          onClick={() => commit(value + range.step)}
        >
          <ChevronUp size={12} />
        </button>
        <button
          type="button"
          className="btn-spin"
          aria-label={`Decrease ${label}`}
          onClick={() => commit(value - range.step)}
        >
          <ChevronDown size={12} />
        </button>
      </div>
    </div>
  );
};

export default NumberSpinner;
