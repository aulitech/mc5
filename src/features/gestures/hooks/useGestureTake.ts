import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useOtaEvent } from "../../../device/useOtaEvent";
import { notify } from "../../../lib/notify";
import type { Sample } from "../../../types/gestures";
import { useSensorRecorder } from "./useSensorRecorder";

/**
 * Where a take is:
 *   idle ─start()→ waiting   until REPORTS_BEFORE_TIMER sensor reports arrive
 *        → ready             timer shown; LEAD_IN_MS to get set
 *        → capturing         the timer counts down the capture window
 *        → review            Accept/Reject (saving while Accept is in progress)
 */
export type TakePhase = "idle" | "waiting" | "ready" | "capturing" | "review" | "saving";

// Reports that must arrive before the timer shows, so the take only starts
// once data is flowing.
const REPORTS_BEFORE_TIMER = 10;
const LEAD_IN_MS = 1000;
// Give up if the stream doesn't deliver within this long.
const STREAM_TIMEOUT_MS = 5000;

/**
 * One recording take at a time, for the record controls in the viewer.
 * `save` stores an accepted take; it resolves false if that failed, which
 * keeps the take so Accept can be retried.
 */
export function useGestureTake(durationMs: number, save: (gestureName: string, samples: Sample[]) => Promise<boolean>) {
  const recorder = useSensorRecorder(durationMs);
  const [phase, setPhase] = useState<TakePhase>("idle");
  // The last capture, with the name it was recorded under, so changing the
  // gesture meanwhile doesn't relabel it.
  const [take, setTake] = useState<{ gestureName: string; samples: Sample[] } | null>(null);
  const nameRef = useRef("");
  const reportsRef = useRef(0);

  useOtaEvent("sensor", () => {
    if (phase !== "waiting") return;
    reportsRef.current += 1;
    if (reportsRef.current === REPORTS_BEFORE_TIMER) setPhase("ready");
  });

  useEffect(() => {
    if (phase !== "waiting") return;
    const timer = setTimeout(() => {
      notify.error("No sensor data is arriving. Check that Cato is connected and try again.");
      setPhase("idle");
    }, STREAM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const capture = useEffectEvent(async () => {
    setPhase("capturing");
    const samples = await recorder.record();
    if (samples.length === 0) {
      notify.error("No sensor data arrived during the recording. Check that Cato is connected and try again.");
      setPhase("idle");
      return;
    }
    setTake({ gestureName: nameRef.current, samples });
    setPhase("review");
  });

  useEffect(() => {
    if (phase !== "ready") return;
    const timer = setTimeout(() => capture(), LEAD_IN_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const start = (gestureName: string) => {
    if (phase !== "idle") return;
    nameRef.current = gestureName;
    reportsRef.current = 0;
    setPhase("waiting");
  };

  const accept = async () => {
    if (!take || phase !== "review") return;
    setPhase("saving");
    const saved = await save(take.gestureName, take.samples);
    if (saved) setTake(null);
    setPhase(saved ? "idle" : "review");
  };

  const reject = () => {
    setTake(null);
    setPhase("idle");
  };

  return { phase, progress: recorder.progress, take, start, accept, reject };
}

export type GestureTake = ReturnType<typeof useGestureTake>;
