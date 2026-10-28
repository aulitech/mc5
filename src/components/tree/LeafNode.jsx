import React, { useState } from "react";
// Import Icons
import { FileText, Info, ChevronUp, ChevronDown } from "lucide-react";
import { useConfig } from "../../context/ConfigContext";
import { useSettings } from "../../context/SettingsContext";
import styles from "./Tree.module.css";
import { VStack } from "../ui/Utility";
const LeafNode = ({ name, value, path, schema }) => {
  const { setConfigValue, updateConfig, actionList } = useConfig();
  const { isAdvanced } = useSettings();

  // Local state for the number input to allow typing decimals (e.g. "0.5")
  // without the parent state snapping it back to "0" instantly.
  const [localInputValue, setLocalInputValue] = useState(null);

  // 1. Visibility Check
  if (
    schema?.mode === "hidden" ||
    (schema?.mode === "advanced" && !isAdvanced)
  ) {
    return null;
  }

  const type = typeof value;
  const isReadOnly = schema?.readOnly;
  const isActionBinding = schema?.type === "action_binding";
  const hasOptions = schema?.options && Array.isArray(schema.options);

  // Label Logic
  let label = name;
  if (schema?.label) {
    label = isActionBinding ? `${schema.label} ${name}` : schema.label;
  }

  const convert = (val) => {
    const type =  typeof value;
    if (type === "number") return Number(val);
    if (type === "boolean") return Boolean(val);
    if (type === "string") {
      if (val === "null") return null;
      if (val === "true") return true;
      if (val === "false") return false;
      if (!isNaN(val) && val.trim() !== "") return Number(val);

    }
return String(val);
  }

  const handleChange = (newVal, sendToDevice = true) => {
    console.log("Changing config at path:", path, "to new value:", newVal);

    if (sendToDevice) updateConfig(path, convert(newVal));
    else setConfigValue(path, convert(newVal));
  };

  const handleFinal = (e) => {
    updateConfig(path, parseFloat(e.target.value));
  };

  const renderControl = () => {
    /*
    console.warn("path:", path, "value:", value);

    if (hasCustom) {
      return schema.custom(value, path, handleChange, handleFinal);
    }
*/
    // A. Read Only
    // FIX: We explicitly add readOnly={true} to silence the console error
    if (isReadOnly) {
      return (
        <input
          className="input-base"
          disabled
          readOnly={true}
          value={String(value)}
        />
      );
    }

    // B. Action Binding
    if (isActionBinding) {
      return (
        <select
          className="input-base"
          style={{ cursor: "pointer" }}
          value={value}
          onChange={(e) => handleChange(parseInt(e.target.value, 10))}
        >
          {actionList &&
            actionList.map((action, idx) => (
              <option key={idx} value={idx}>
                {action.label || action.command}
              </option>
            ))}
        </select>
      );
    }

    // C. Custom Options
    if (hasOptions) {
      return (
        <select
          className="input-base"
          style={{
            minWidth: "6rem",
            maxWidth: "10rem",
            width: "fit-content",
            cursor: "pointer",
          }}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
        >
          {schema.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label || opt.value}
            </option>
          ))}
        </select>
      );
    }

    // D. Boolean
    if (type === "boolean") {
      return (
        <label className="toggle-switch">
          <input
            style={{ width: "1rem" }}
            type="checkbox"
            checked={value}
            onChange={(e) => handleChange(e.target.checked)}
          />
          {/* The toggle-track and toggle-thumb divs create the visual switch, while the span shows ON/OFF text
          <div className="toggle-track">
            <div className="toggle-thumb" />
          </div>
          <span
            style={{
              fontSize: "smaller
              color: value ? "var(--primary)" : "var(--text-sub)",
            }}
          >
            {value ? "ON" : "OFF"}
          </span> */}
        </label>
      );
    }

    // E. Number (Slider + Custom Spinner)
    if (type === "number") {
      const min = schema?.min ?? 0;
      const max = schema?.max ?? 100;
      const step = schema?.step ?? (Number.isInteger(value) ? 1 : 0.1);

      // Logic to prevent JS floating point errors
      const precision = step.toString().split(".")[1]?.length || 0;

      // Helper to commit change to global config
      const commitValue = (val) => {
        let safeValue = Number(val.toFixed(precision));
        if (safeValue > max) safeValue = max;
        if (safeValue < min) safeValue = min;
        handleChange(safeValue);
      };

      const handleIncrement = () => commitValue(value + step);
      const handleDecrement = () => commitValue(value - step);

      // Handle manual typing
      const handleInputChange = (e) => {
        const val = e.target.value;
        setLocalInputValue(val); // Update display immediately so user can type

        // Only commit to global config if it's a valid completed number
        if (val === "" || val === "-") return;
        const num = parseFloat(val);
        if (!isNaN(num)) {
          commitValue(num);
        }
      };

      // On blur, clear local override so it re-syncs with source of truth
      const handleBlur = () => {
        setLocalInputValue(null);
      };

      // Determine what to show: local typing state OR global source of truth
      const displayValue =
        localInputValue !== null ? localInputValue : String(value);

      return (
        <VStack
          style={{
            padding: 0,
            gap: 0,
            justifyContent: "flex-start",
            alignItems: "flex-end",
            width: "fit-content",
          }}
        >
          <div
            className="custom-spinner-wrapper"
            style={{ minWidth: "fit-content", margin: 0 }}
          >
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input-base spinner-input input-number-no-spin"
              style={{
                fontSize: "smaller",
                minWidth: "1rem",
                width: "5rem",
                textAlign: "right",
                background: "transparent",
                border: "none",
                outline: "none",
              }} // Override width for full container fill
              value={displayValue}
              onChange={handleInputChange}
              onBlur={handleBlur}
            />
            <div className="spinner-btns">
              <button
                type="button"
                className="btn-spin"
                onClick={handleIncrement}
              >
                <ChevronUp size={12} />
              </button>
              <button
                type="button"
                className="btn-spin"
                onClick={handleDecrement}
              >
                <ChevronDown size={12} />
              </button>
            </div>
          </div>
          <input
            type="range"
            className="range-slider"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => handleChange(parseFloat(e.target.value), false)}
            onMouseUp={handleFinal}
            style={{ width: "100%" }}
          />
        </VStack>
      );
    }

    // F. Default Text
    return (
      <input
        type="text"
        className="input-base"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
      />
    );
  };

  return (
    <div className={styles["node-leaf"]}>
      <div className={styles["label-cell"]}>
        {isReadOnly && <span className={styles["badge-readonly"]}>LOCK</span>}
        <div className="tooltip-wrapper">
          <span title={label} className={styles["label-text"]}>
            {label ?? null}
          </span>
          <div className="tooltip-content">{schema?.description ?? null}</div>
        </div>
      </div>
      <div
        className="input-cell"
        style={{ justifyContent: "flex-end", width: "100%", minWidth: 0 }}
      >
        {renderControl()}
      </div>
    </div>
  );
};

export default LeafNode;
