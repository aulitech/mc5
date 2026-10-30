import { useEffect, useState } from "react";
import ota from "../../../device/ota";
import { errorMessage, notify } from "../../../lib/notify";

/**
 * Turn the device's IMU stream on while `enabled` (and the calling component
 * is mounted), and off again afterwards. Returns true once the device has
 * confirmed the stream is running.
 */
export function useSensorStream(enabled: boolean) {
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    ota
      .send("sensor_stream on")
      .then(() => {
        if (active) setIsStreaming(true);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Gestures: failed to start sensor stream", err);
        notify.error(`Couldn't start the sensor stream: ${errorMessage(err)}`);
      });

    return () => {
      active = false;
      setIsStreaming(false);
      ota
        .send("sensor_stream off")
        .catch((err) => console.log("[gestures] sensor_stream off failed:", errorMessage(err)));
    };
  }, [enabled]);

  return isStreaming;
}
