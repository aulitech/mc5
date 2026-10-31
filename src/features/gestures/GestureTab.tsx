// GestureTab.tsx — Gesture collection, visualization and template models.
//
// Layout only — state lives in GestureStoreProvider (recordings, viewer,
// models). The sensor stream runs while a gesture is chosen for recording or
// a pane is live.
//
// Data flow:
//   "+ Gesture" or the saved gestures list → store.selectGesture → viewer goes
//   live, Record shown
//   (hidden again while a recording or standard gesture replays)
//   Record → useGestureTake (device sensor events) → Accept → store.addRecording
//   store.views (one pane, or two when comparing) → GestureVisualizer, which
//   replays recordings or follows the device sensor events live
//   checked classes/standard gestures → "+ Model" (ModelList) → store.generateModel

import { Plus } from "lucide-react";
import { useDialog } from "../../context/DialogContext";
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
  const visible = compare ? views : views.slice(0, 1);
  const showsLive = visible.some((v) => v?.kind === "live");
  const replaying = visible.some((v) => v !== null && v.kind !== "live");
  const isStreaming = useSensorStream(activeGesture !== null || showsLive);
  const take = useGestureTake(RECORD_MS, addRecording);
  // Record stays out of the way of a replay (choosing the gesture or Live
  // brings it back); a take already under way keeps its controls.
  const showRecordControls = activeGesture !== null && (take.phase !== "idle" || !replaying);
  const { prompt } = useDialog();

  // Name a new gesture; it's chosen for recording (it joins the list with its first take).
  const handleNewGesture = async () => {
    const name = (await prompt("Name the new gesture:"))?.trim();
    if (name) selectGesture(name);
  };

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
          {/* Heading, with "+ Gesture" under it (like "Add Profile") */}
          <div className={styles.pageSectionHeader}>
            <h3 className={styles.pageSectionTitle}>Gestures</h3>
            <button className={`btn-primary ${styles.addBtn}`} onClick={handleNewGesture}>
              <Plus size={16} />
              Gesture
            </button>
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
          <ModelList />
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
