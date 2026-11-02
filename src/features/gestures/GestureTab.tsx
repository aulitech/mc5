// GestureTab.tsx — Gesture collection, visualization and the template model.
//
// Layout only — state lives in GestureStoreProvider (recordings, viewer,
// model slots). The sensor stream runs while a gesture is chosen for recording or
// a pane is live, unless it's paused (⏸ beside Compare; Record resumes it).
//
// Data flow:
//   "+" (below the list) or a gesture in it → store.selectGesture → viewer goes
//   live, Record shown
//   (hidden again while a recording or standard gesture replays)
//   Record → useGestureTake (device sensor events) → Accept → store.addRecording
//   (everything but the viewer pane is locked from Record until Accept/Reject:
//   RecordOverlay → usePageLock)
//   store.views (one pane, or two when comparing) → GestureVisualizer, which
//   replays recordings or follows the device sensor events live
//   model slots (ModelSection) → Install → store.buildModel → xcorr_model.zip

import { useState } from "react";
import GestureSummary from "./components/GestureSummary";
import GestureVisualizer from "./components/GestureVisualizer";
import ModelSection from "./components/ModelSection";
import RecordOverlay from "./components/RecordOverlay";
import { useGestureTake } from "./hooks/useGestureTake";
import { useSensorStream } from "./hooks/useSensorStream";
import { GestureStoreProvider } from "./state/GestureStoreProvider";
import { useGestureStore } from "./state/GestureStoreContext";
import styles from "./GestureTab.module.css";

// Length of one recording window.
const RECORD_MS = 2500;

const GestureTabContent = () => {
  const { views, compare, activeGesture, selectGesture, addRecording, resetPosition } = useGestureStore();
  const visible = compare ? views : views.slice(0, 1);
  const showsLive = visible.some((v) => v.kind === "live");
  const replaying = visible.some((v) => v.kind !== "live");
  // Paused from the viewer's bar: the stream stops and the live model holds still.
  const [streamPaused, setStreamPaused] = useState(false);
  const isStreaming = useSensorStream((activeGesture !== null || showsLive) && !streamPaused);
  const take = useGestureTake(RECORD_MS, addRecording);
  // Record stays out of the way of a replay (choosing the gesture, or Live in
  // the viewer, brings it back); a take already under way keeps its controls.
  const showRecordControls = activeGesture !== null && (take.phase !== "idle" || !replaying);
  const handleRecord = () => {
    if (!activeGesture) return;
    selectGesture(activeGesture); // back to a single live pane at normal speed
    resetPosition(); // the take starts from the rest pose
    setStreamPaused(false); // a take needs the stream (it waits for its first reports)
    take.start(activeGesture);
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainLayout}>
        <div className={styles.pageSection}>
          <div className={styles.pageSectionHeader}>
            <h3 className={styles.pageSectionTitle}>Personal Gestures</h3>
          </div>
          <div className={styles.pageSectionBody}>
            {/* Column 1: saved gestures (choose one to record) */}
            <div className={styles.leftPanel}>
              <GestureSummary />
            </div>

            {/* Column 2: viewer, with the record controls over it */}
            <div className={styles.visualizerColumn}>
              <GestureVisualizer
                isStreaming={isStreaming}
                streamPaused={streamPaused}
                onStreamPausedChange={setStreamPaused}
                isRecording={take.phase !== "idle"}
                overlay={
                  showRecordControls && (
                    <RecordOverlay gestureName={activeGesture} take={take} onRecord={handleRecord} />
                  )
                }
              />
            </div>
          </div>
        </div>

        <div className={styles.pageSection}>
          <ModelSection />
        </div>
      </div>
    </div>
  );
};

const GestureTab = () => (
  <GestureStoreProvider>
    <GestureTabContent />
  </GestureStoreProvider>
);

export default GestureTab;
