// GestureTab.tsx — Gesture collection, visualization and template models.
//
// Layout only — state lives in GestureStoreProvider (recordings, viewer,
// models). The sensor stream runs while a gesture is chosen for recording or
// a pane is live.
//
// Data flow:
//   saved gestures list → store.selectGesture → viewer goes live, Record shown
//   Record → useGestureTake (device sensor events) → Accept → store.addRecording
//   store.views (one pane, or two when comparing) → GestureVisualizer, which
//   replays recordings or follows the device sensor events live
//   checked classes/standard gestures → Generate model (ModelList) → store.generateModel

import GestureSummary from "./components/GestureSummary";
import GestureVisualizer from "./components/GestureVisualizer";
import ModelList from "./components/ModelList";
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
  const showsLive = (compare ? views : views.slice(0, 1)).some((v) => v?.kind === "live");
  const isStreaming = useSensorStream(activeGesture !== null || showsLive);
  const take = useGestureTake(RECORD_MS, addRecording);

  const handleRecord = () => {
    if (!activeGesture) return;
    selectGesture(activeGesture); // back to a single live pane at normal speed
    resetPosition(); // the take starts from the rest pose
    take.start(activeGesture);
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainLayout}>
        <div className={styles.pageSection}>
          <h3 className={styles.pageSectionTitle}>Gesture Recordings</h3>
          <div className={styles.pageSectionBody}>
            {/* Column 1: saved gestures (choose one to record) */}
            <div className={styles.leftPanel}>
              <GestureSummary />
            </div>

            {/* Column 2: viewer, with the record controls over it */}
            <div className={styles.visualizerColumn}>
              <GestureVisualizer
                isStreaming={isStreaming}
                isRecording={take.phase !== "idle"}
                overlay={
                  activeGesture !== null && (
                    <RecordOverlay gestureName={activeGesture} take={take} onRecord={handleRecord} />
                  )
                }
              />
            </div>
          </div>
        </div>

        <div className={styles.pageSection}>
          <h3 className={styles.pageSectionTitle}>Gesture Models</h3>
          <div className={styles.pageSectionBody}>
            <ModelList />
          </div>
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
