import {
  MOUSE_OPTS,
  KEY_TO_HID,
  MODIFIERS,
  DEVICE_TYPES,
  SCROLL_TYPES,
  BUTTON_ACTIONS,
  AXIS_OPTS,
} from "../constants/mappings";

export const getHidLabel = (actor, code) => {
  if (actor === 0) {
    const mouse = MOUSE_OPTS.find((m) => m.value === code);
    if (mouse) return mouse.label;
  } else {
    const key = Object.keys(KEY_TO_HID).find((k) => KEY_TO_HID[k] === code);
    if (key) return key.replace(/[{}]/g, "");
  }
  return `Invalid ${code}`;
};

export const getModifierLabel = (mask) => {
  if (mask === 0) return "";
  return MODIFIERS.filter((m) => (mask & m.mask) !== 0)
    .map((m) => m.label)
    .join(" + ");
};

export const calcModifierMask = (labels) =>
  labels.reduce((mask, label) => {
    const mod = MODIFIERS.find((m) => m.label === label);
    return mod ? mask | mod.mask : mask;
  }, 0);

export const getActionSummary = (action) => {
  if (!action) return null;
  if (action.command === "button") {
    const [actor, type, nested] = action.args || [0, "tap", [0, 0]];
    const [id, mask] = Array.isArray(nested) ? nested : [nested, 0];
    const name = getHidLabel(actor, id);
    const mods = getModifierLabel(mask);
    return (
      <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
        <span className="arg-pill">
          {DEVICE_TYPES.find((t) => t.value === actor)?.label}
        </span>
        <span className="arg-pill">{type}</span>
        {mods && <span className="arg-pill">{mods} +</span>}
        <span className="arg-pill">{name}</span>
      </div>
    );
  }
  if (action.command === "scroll") {
    const type = action.args ? action.args[0] : "fixed";
    return <span className="arg-pill">{type} mode</span>;
  }
  return null;
};
