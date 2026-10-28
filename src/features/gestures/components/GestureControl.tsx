// GestureControl.tsx — Record, preview, accept, or reject a gesture.
//
// Ported from expense-tracker/mvp/components/GestureControl.js.
// Changes: no BLE, no Firebase, captures from the device sensor stream,
// saves via the gesture store.

import { useEffect, useEffectEvent, useState } from "react";
import { notify } from "../../../lib/notify";
import type { Sample } from "../../../types/gestures";
import { useSensorRecorder } from "../hooks/useSensorRecorder";
import { useGestureStore } from "../state/GestureStoreContext";
import styles from "../GestureTab.module.css";

// Length of one recording window.
const RECORD_MS = 2500;
// Pause between accept/reject and the next recording when auto-advancing.
const AUTO_ADVANCE_DELAY_MS = 500;

interface GestureControlProps {
  gestureName: string;
  isStreaming: boolean;
}

function GestureControl({ gestureName, isStreaming }: GestureControlProps) {
  const { addRecording } = useGestureStore();
  const recorder = useSensorRecorder(RECORD_MS);
  // The last recording, awaiting Accept/Reject — with the name it was
  // recorded under, so changing the name meanwhile doesn't relabel it.
  const [captured, setCaptured] = useState<{ name: string; samples: Sample[] } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [autoStartPending, setAutoStartPending] = useState(false);

  const name = gestureName.trim();
  const isReady = captured !== null;
  const canRecord = name !== "" && isStreaming && !recorder.isRecording && !isReady && !isSaving;

  const handleRecord = async () => {
    if (!canRecord) return;
    const recordedAs = name;
    const samples = await recorder.record();
    console.log(`[GestureControl] captured ${samples.length} samples`);
    if (samples.length === 0) {
      notify.error("No sensor data arrived during the recording. Check that Cato is connected and try again.");
      return;
    }
    setCaptured({ name: recordedAs, samples });
  };

  const handleAccept = async () => {
    if (!captured) return;
    setIsSaving(true);
    const saved = await addRecording(captured.name, captured.samples);
    setIsSaving(false);
    if (!saved) return; // keep the capture so Accept can be retried
    setCaptured(null);
    if (autoAdvance) setAutoStartPending(true);
  };

  const handleReject = () => {
    setCaptured(null);
    if (autoAdvance) setAutoStartPending(true);
  };

  // After accept/reject, wait briefly before auto-starting the next recording.
  const startNext = useEffectEvent(() => {
    handleRecord();
  });
  useEffect(() => {
    if (!autoStartPending) return;
    const timer = setTimeout(() => {
      setAutoStartPending(false);
      startNext();
    }, AUTO_ADVANCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [autoStartPending]);

  return (
    <div className={styles.gestureControl}>
      {isSaving && <p className={styles.savingMsg}>Saving…</p>}
      {captured && !isSaving && (
        <p className={styles.savingMsg}>
          Recorded "{captured.name}" ({captured.samples.length} samples) — accept or reject.
        </p>
      )}

      {/* Progress bar — gradient track (red|green|red) with elapsed cover */}
      <div className={styles.progressBarContainer}>
        <div className={styles.progressBarWrap}>
          <div
            className={styles.progressElapsed}
            style={{ width: `${recorder.progress * 100}%` }}
            role="progressbar"
            aria-label="Recording progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(recorder.progress * 100)}
          />
        </div>
        <span className={styles.labelStart}>Start Gesture</span>
        <span className={styles.labelEnd}>End Gesture</span>
      </div>

      <div className={styles.controlRow}>
        <button onClick={handleRecord} disabled={!canRecord} className={styles.btn}>
          Record
        </button>

        <label className={styles.checkLabel}>
          <input type="checkbox" checked={autoAdvance} onChange={() => setAutoAdvance((v) => !v)} />
          Auto-advance
        </label>
      </div>

      <div className={styles.controlRow}>
        <button onClick={handleAccept} disabled={!isReady || isSaving} className={styles.btnAccept}>
          Accept
        </button>
        <button onClick={handleReject} disabled={!isReady || isSaving} className={styles.btnReject}>
          Reject
        </button>
      </div>
    </div>
  );
}

export default GestureControl;
