import { PointerCurveGraph } from "../tools/PointerCurveGraph";
import { useConfig } from "../../context/ConfigContext";

// Custom editor for profiles[i].pointer.acceleration (see UI_SCHEMA `custom`).
// Dragging the curve updates the local copy; releasing sends it to the device.
const AccelerationEditor = ({ data, path, schema }) => {
  const { setConfigValue, updateConfig } = useConfig();

  const accel = data || {
    start: 20,
    stop: 40,
    scale_slow: 0.6,
    scale_fast: 1.8,
  };

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <PointerCurveGraph
        title=""
        data={accel}
        limits={schema?.acceleration}
        onChange={(newAccel) => setConfigValue(path, newAccel)}
        onSave={(newAccel) => updateConfig(path, newAccel)}
      />
    </div>
  );
};
export default AccelerationEditor;
