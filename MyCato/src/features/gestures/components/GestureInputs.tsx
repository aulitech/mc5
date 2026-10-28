// GestureInputs.tsx — Gesture name selector.
//
// Lets the user pick an existing gesture class from a dropdown or type a new
// one. Controlled: the parent owns the name.
//
// Ported from expense-tracker/mvp/components/GestureInputs.js.
// Changes: no Firebase (uses gestureDB), no location dropdown.

import { useState, type ChangeEvent } from "react";
import { useGestureStore } from "../state/GestureStoreContext";
import styles from "../GestureTab.module.css";

const NEW_GESTURE = "new_gesture";

interface GestureInputsProps {
  gestureName: string;
  onChange: (gestureName: string) => void;
}

function GestureInputs({ gestureName, onChange }: GestureInputsProps) {
  const { counts } = useGestureStore();
  const [isNewGesture, setIsNewGesture] = useState(false);
  const existingGestures = Object.keys(counts).sort();

  const handleDropdownChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setIsNewGesture(val === NEW_GESTURE);
    onChange(val === NEW_GESTURE ? "" : val);
  };

  return (
    <div className={styles.inputGroup}>
      <select
        id="gestureDropdown"
        aria-label="Gesture Name"
        value={isNewGesture ? NEW_GESTURE : gestureName}
        onChange={handleDropdownChange}
      >
        <option value="">Select gesture…</option>
        {existingGestures.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={NEW_GESTURE}>+ New gesture</option>
      </select>

      {/* Show a text field when the user wants to define a new class name */}
      {isNewGesture && (
        <input
          type="text"
          placeholder="Enter gesture name"
          value={gestureName}
          onChange={(e) => onChange(e.target.value)}
          className={styles.textInput}
          autoFocus
        />
      )}
    </div>
  );
}

export default GestureInputs;
