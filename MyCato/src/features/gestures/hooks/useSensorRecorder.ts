import { useCallback, useEffect, useRef, useState } from "react";
import { useOtaEvent } from "../../../device/useOtaEvent";
import type { SensorReport } from "../../../types/device";
import type { Sample } from "../../../types/gestures";

const PROGRESS_TICK_MS = 20;

// The device layer emits {x,y,z} objects; gesture code works in [x,y,z] arrays.
const toSample = (s: SensorReport): Sample => ({
  ts: s.ts,
  acc: [s.acc.x, s.acc.y, s.acc.z],
  gyro: [s.gyro.x, s.gyro.y, s.gyro.z],
});

/**
 * Capture IMU samples for a fixed wall-clock window. Requires the sensor
 * stream to be on (see useSensorStream). `record()` resolves with the
 * captured samples; `progress` runs 0 → 1 while recording.
 */
export function useSensorRecorder(durationMs: number) {
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const bufferRef = useRef<Sample[] | null>(null);
  const finishRef = useRef<(() => void) | null>(null);

  useOtaEvent("sensor", (report) => {
    bufferRef.current?.push(toSample(report));
  });

  // Unmounting mid-recording ends it with whatever was captured.
  useEffect(() => () => finishRef.current?.(), []);

  const record = useCallback(
    () =>
      new Promise<Sample[]>((resolve) => {
        const buffer: Sample[] = [];
        const startedAt = performance.now();
        bufferRef.current = buffer;
        setIsRecording(true);
        setProgress(0);

        const timer = setInterval(() => {
          const p = Math.min(1, (performance.now() - startedAt) / durationMs);
          setProgress(p);
          if (p >= 1) finish();
        }, PROGRESS_TICK_MS);

        const finish = () => {
          clearInterval(timer);
          bufferRef.current = null;
          finishRef.current = null;
          setIsRecording(false);
          setProgress(0);
          resolve(buffer);
        };
        finishRef.current = finish;
      }),
    [durationMs],
  );

  return { record, isRecording, progress };
}
