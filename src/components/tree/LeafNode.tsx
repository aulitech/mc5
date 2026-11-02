import { useState, type KeyboardEvent } from "react";
import { useConfig } from "../../context/ConfigContext";
import { useSettings } from "../../context/SettingsContext";
import type { SchemaNode } from "../../constants/schemas";
import { SLIDER_KEYS, clampToRange, textToLeafValue, type NumberRange } from "../../lib/leafValue";
import type { ConfigPath } from "../../types/config";
import styles from "./Tree.module.css";
import NumberSpinner from "../ui/NumberSpinner";
import { VStack } from "../ui/Utility";

interface LeafNodeProps {
  name: string;
  value: unknown;
  path: ConfigPath;
  schema: SchemaNode | null;
}

// Commit typed text on Enter; drop the draft on Escape.
const commitKeys =
  (commit: () => void, cancel: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") cancel();
  };

const LeafNode = ({ name, value, path, schema }: LeafNodeProps) => {
  const { setConfigValue, updateConfig, actionList } = useConfig();
  const { isAdvanced } = useSettings();

  // Text being typed into an input, not yet sent. Sent on Enter or blur, so
  // a half-typed value (e.g. "0." or the "1" of "150") never reaches Cato.
  const [draft, setDraft] = useState<string | null>(null);

  if (schema?.mode === "hidden" || (schema?.mode === "advanced" && !isAdvanced)) {
    return null;
  }

  const isActionBinding = schema?.type === "action_binding";
  const label = schema?.label ? (isActionBinding ? `${schema.label} ${name}` : schema.label) : name;
  const send = (next: unknown) => updateConfig(path, next);
  const cancelDraft = () => setDraft(null);

  const renderControl = () => {
    // A. Read Only
    if (schema?.readOnly) {
      return <input className="input-base" aria-label={label} disabled readOnly value={String(value)} />;
    }

    // B. Action Binding
    if (isActionBinding) {
      return (
        <select
          className="input-base"
          aria-label={label}
          style={{ cursor: "pointer" }}
          value={Number(value)}
          onChange={(e) => send(parseInt(e.target.value, 10))}
        >
          {actionList.map((action, idx) => (
            <option key={idx} value={idx}>
              {action.label || action.command}
            </option>
          ))}
        </select>
      );
    }

    // C. Custom Options — send the option's own value, keeping its type.
    if (Array.isArray(schema?.options)) {
      const options = schema.options;
      return (
        <select
          className="input-base"
          aria-label={label}
          style={{ minWidth: "6rem", maxWidth: "10rem", width: "fit-content", cursor: "pointer" }}
          value={String(value)}
          onChange={(e) => {
            const option = options.find((opt) => String(opt.value) === e.target.value);
            if (option) send(option.value);
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={String(opt.value)}>
              {opt.label || opt.value}
            </option>
          ))}
        </select>
      );
    }

    // D. Boolean
    if (typeof value === "boolean") {
      return (
        <label className="toggle-switch">
          <input
            style={{ width: "1rem" }}
            type="checkbox"
            aria-label={label}
            checked={value}
            onChange={(e) => send(e.target.checked)}
          />
        </label>
      );
    }

    // E. Number (Slider + Custom Spinner)
    if (typeof value === "number") {
      const range: NumberRange = {
        min: schema?.min ?? 0,
        max: schema?.max ?? 100,
        step: schema?.step ?? (Number.isInteger(value) ? 1 : 0.1),
      };
      const commit = (n: number) => send(clampToRange(n, range));
      // Slider: track locally while dragging/arrowing, send when let go.
      const commitSlider = (e: { currentTarget: HTMLInputElement }) => commit(parseFloat(e.currentTarget.value));

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
          <NumberSpinner value={value} range={range} label={label} onCommit={send} />
          <input
            type="range"
            className="range-slider"
            aria-label={label}
            min={range.min}
            max={range.max}
            step={range.step}
            value={value}
            onChange={(e) => setConfigValue(path, parseFloat(e.target.value))}
            onPointerUp={commitSlider}
            onKeyUp={(e) => SLIDER_KEYS.has(e.key) && commitSlider(e)}
            style={{ width: "100%" }}
          />
        </VStack>
      );
    }

    // F. Default Text
    const commitText = () => {
      if (draft === null) return;
      const next = textToLeafValue(draft, value);
      setDraft(null);
      if (next !== value) send(next);
    };
    return (
      <input
        type="text"
        className="input-base"
        aria-label={label}
        value={draft ?? (value === null || value === undefined ? "" : String(value))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitText}
        onKeyDown={commitKeys(commitText, cancelDraft)}
      />
    );
  };

  return (
    <div className={styles["node-leaf"]}>
      <div className={styles["label-cell"]}>
        {schema?.readOnly && <span className={styles["badge-readonly"]}>LOCK</span>}
        <div className="tooltip-wrapper" tabIndex={schema?.description ? 0 : undefined}>
          <span title={label} className={styles["label-text"]}>
            {label}
          </span>
          {schema?.description && <div className="tooltip-content">{schema.description}</div>}
        </div>
      </div>
      <div className="input-cell" style={{ justifyContent: "flex-end", width: "100%", minWidth: 0 }}>
        {renderControl()}
      </div>
    </div>
  );
};

export default LeafNode;
