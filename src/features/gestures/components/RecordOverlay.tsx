// RecordOverlay.tsx — Record controls drawn over the viewer's main pane.
//
// Record sits in the middle of the pane and hides once pressed. When the take
// has data coming in, the timer appears across the top and counts down the
// capture window; when it runs out, Accept/Reject appear where Record was.
// See useGestureTake for the steps.

import type { GestureTake } from "../hooks/useGestureTake";
import styles from "../GestureTab.module.css";

interface RecordOverlayProps {
  /** The gesture the next take is recorded as. */
  gestureName: string;
  take: GestureTake;
  onRecord: () => void;
}

const RecordOverlay = ({ gestureName, take, onRecord }: RecordOverlayProps) => {
  const { phase, progress } = take;
  const showTimer = phase === "ready" || phase === "capturing";
  const reviewing = phase === "review" || phase === "saving";

  return (
    <>
      {showTimer && (
        <div className={styles.vizTimer}>
          {/* Gradient track (red | green | red), cut back from the right as time runs out */}
          <div className={styles.progressBarContainer}>
            <div
              className={styles.progressBarWrap}
              style={{ clipPath: `inset(0 ${progress * 100}% 0 0 round 4px)` }}
              role="progressbar"
              aria-label="Recording progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
            />
            <span className={styles.labelStart}>Start Gesture</span>
            <span className={styles.labelEnd}>End Gesture</span>
          </div>
        </div>
      )}

      <div className={styles.vizRecord}>
        {phase === "idle" && (
          <button className={`${styles.btn} ${styles.vizRecordBtn}`} onClick={onRecord}>
            Record "{gestureName}"
          </button>
        )}
        {reviewing && (
          <>
            <button className={`${styles.btn} ${styles.vizAcceptBtn}`} onClick={take.accept} disabled={phase === "saving"}>
              {phase === "saving" ? "Saving…" : "Accept"}
            </button>
            <button className={`${styles.btn} ${styles.vizRejectBtn}`} onClick={take.reject} disabled={phase === "saving"}>
              Reject
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default RecordOverlay;
