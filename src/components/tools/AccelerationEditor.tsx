import { PointerCurveGraph, type Acceleration, type AccelerationLimits } from "./PointerCurveGraph";
import { useConfig } from "../../context/ConfigContext";
import type { SchemaNode } from "../../constants/schemas";
import type { ConfigPath } from "../../types/config";

/** Props every custom editor named by a schema node's `custom` receives. */
export interface CustomEditorProps {
  data: unknown;
  path: ConfigPath;
  schema: SchemaNode | null;
}

const DEFAULT_ACCELERATION: Acceleration = {
  start: 20,
  stop: 40,
  scale_slow: 0.6,
  scale_fast: 1.8,
};

// Custom editor for profiles[i].pointer.acceleration (see UI_SCHEMA `custom`).
// Dragging the curve updates the local copy; releasing sends it to the device.
// The schema node itself holds the per-field min/max (start, stop, ...).
const AccelerationEditor = ({ data, path, schema }: CustomEditorProps) => {
  const { setConfigValue, updateConfig } = useConfig();
  const accel = (data as Acceleration | null) ?? DEFAULT_ACCELERATION;

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <PointerCurveGraph
        data={accel}
        limits={schema as AccelerationLimits | null}
        onChange={(newAccel) => setConfigValue(path, newAccel)}
        onSave={(newAccel) => updateConfig(path, newAccel)}
      />
    </div>
  );
};
export default AccelerationEditor;
