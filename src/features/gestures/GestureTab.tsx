// GestureTab.tsx — Gesture collection, visualization and template models.
//
// Layout only — state lives in GestureStoreProvider (recordings, selection,
// models), and the sensor stream is on for as long as the tab is open.
//
// Data flow:
//   device sensor events → useSensorRecorder (in GestureControl) → store.addRecording
//   store.selection → GestureVisualizer
//   checked classes/standard gestures → store.generateModel → ModelList

import { useState } from "react";
import { useDialog } from "../../context/DialogContext";
import GestureControl from "./components/GestureControl";
import GestureInputs from "./components/GestureInputs";
import GestureSummary from "./components/GestureSummary";
import GestureVisualizer from "./components/GestureVisualizer";
import ModelList from "./components/ModelList";
import { useSensorStream } from "./hooks/useSensorStream";
import { GestureStoreProvider } from "./state/GestureStoreProvider";
import { useGestureStore } from "./state/GestureStoreContext";
import styles from "./GestureTab.module.css";

const GestureTabContent = () => {
  const isStreaming = useSensorStream();
  const [gestureName, setGestureName] = useState("");
  const { selection, checkedClasses, checkedStandards, isGenerating, generateModel } = useGestureStore();
  const { prompt } = useDialog();

  const nothingChecked = checkedClasses.size === 0 && checkedStandards.size === 0;

  const handleGenerateModel = async () => {
    const modelName = (await prompt("Name this gesture model:"))?.trim();
    if (modelName) await generateModel(modelName);
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainLayout}>
        <div className={styles.pageSection}>
          <h3 className={styles.pageSectionTitle}>Gesture Recordings</h3>
          <div className={styles.pageSectionBody}>
            {/* Column 1: inputs, record controls, saved gestures */}
            <div className={`${styles.leftPanel} ${styles.recordingsPanel}`}>
              <GestureInputs gestureName={gestureName} onChange={setGestureName} />
              <GestureControl gestureName={gestureName} isStreaming={isStreaming} />
              <GestureSummary />
              <button
                className={styles.btn}
                onClick={handleGenerateModel}
                disabled={nothingChecked || isGenerating}
              >
                {isGenerating ? "Generating…" : "Generate Gesture Model"}
              </button>
            </div>

            {/* Column 2: visualizer only */}
            <div className={styles.visualizerColumn}>
              <GestureVisualizer imuData={selection?.samples} />
            </div>
          </div>
        </div>

        <div className={styles.pageSection}>
          <h3 className={styles.pageSectionTitle}>Your Gesture Models</h3>
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
