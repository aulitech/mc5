// GestureSummary.tsx — Shows saved gesture classes and their individual recordings.
//
// Each class row can be expanded/collapsed to reveal the list of individual
// recordings. From there the user can:
//   • Click a recording to load it in the 3D visualizer
//   • Delete a single recording
//   • Rename or delete the entire class (all recordings)
//   • Check classes / standard gestures for model generation

import { useState, type MouseEvent } from "react";
import { useDialog } from "../../../context/DialogContext";
import type { Recording } from "../../../types/gestures";
import { STANDARD_GESTURES } from "../data/standardGestures";
import { useGestureStore } from "../state/GestureStoreContext";
import styles from "../GestureTab.module.css";

// Format an ISO timestamp string into a short "MM/DD HH:MM" label.
function fmtTime(isoStr: string) {
  const d = new Date(isoStr);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function GestureSummary() {
  const store = useGestureStore();
  const { confirm, prompt } = useDialog();
  // Every class currently showing its recordings list — any number can be
  // open at once.
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(() => new Set());

  const replaceExpanded = (from: string, to?: string) =>
    setExpandedClasses((prev) => {
      if (!prev.has(from)) return prev;
      const next = new Set(prev);
      next.delete(from);
      if (to) next.add(to);
      return next;
    });

  const handleClassClick = (name: string) => {
    if (expandedClasses.has(name)) {
      replaceExpanded(name);
    } else {
      setExpandedClasses((prev) => new Set(prev).add(name));
      store.loadRecordings(name);
    }
  };

  const handleDeleteClass = async (e: MouseEvent, name: string) => {
    e.stopPropagation(); // don't also trigger handleClassClick
    if (!(await confirm(`Delete all recordings for "${name}"?`))) return;
    await store.deleteClass(name);
    replaceExpanded(name);
  };

  const handleRenameClass = async (e: MouseEvent, name: string) => {
    e.stopPropagation(); // don't also trigger handleClassClick
    const newName = (await prompt("Rename gesture:", name))?.trim();
    if (!newName || newName === name) return;
    if (store.counts[newName] && !(await confirm(`"${newName}" already exists. Merge "${name}" into it?`))) return;
    await store.renameClass(name, newName);
    replaceExpanded(name, newName);
  };

  const handleDeleteRecording = (e: MouseEvent, rec: Recording) => {
    e.stopPropagation();
    store.deleteRecording(rec);
  };

  const { selection } = store;
  const entries = Object.entries(store.counts);

  return (
    <div className={styles.summary}>
      <h4>Saved Gestures</h4>

      {entries.length === 0 && <p className={styles.emptyMsg}>No recordings yet.</p>}

      <ul className={styles.summaryList}>
        {entries.map(([name, count]) => {
          const recordings = store.recordings[name];
          return (
            <li key={name} className={styles.classGroup}>
              {/* ── Class header row ── */}
              <div
                className={styles.summaryItem}
                onClick={() => handleClassClick(name)}
                title="Click to expand recordings"
              >
                <input
                  type="checkbox"
                  className={styles.templateCheckbox}
                  checked={store.checkedClasses.has(name)}
                  onChange={() => store.toggleClass(name)}
                  onClick={(e) => e.stopPropagation()}
                  title="Select for template generation"
                />
                <button
                  className={styles.btnDanger}
                  onClick={(e) => handleDeleteClass(e, name)}
                  title={`Delete all "${name}" recordings`}
                >
                  ×
                </button>
                <button
                  className={styles.btnView}
                  onClick={(e) => handleRenameClass(e, name)}
                  title={`Rename "${name}"`}
                >
                  ✎
                </button>
                <span className={styles.gestureCount}>{count}</span>
                <span className={styles.gestureName}>{name}</span>
              </div>

              {/* ── Expanded recordings list ── */}
              {expandedClasses.has(name) && (
                <ul className={styles.recordingList}>
                  {!recordings && <li className={styles.emptyMsg}>Loading…</li>}
                  {recordings?.length === 0 && <li className={styles.emptyMsg}>No recordings found.</li>}
                  {recordings?.map((rec) => (
                    <li
                      key={rec.id}
                      className={`${styles.recordingItem} ${selection?.kind === "recording" && selection.id === rec.id ? styles.active : ""}`}
                      onClick={() => store.selectRecording(rec)}
                      title="Click to visualize this recording"
                    >
                      <span className={styles.recordingMeta}>{fmtTime(rec.timestamp)}</span>
                      <button
                        className={styles.btnDanger}
                        onClick={(e) => handleDeleteRecording(e, rec)}
                        title="Delete this recording"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* ── Standard gestures ── */}
      <div className={styles.standardDivider} />
      <h4 className={styles.standardGesturesHeading}>Standard Gestures</h4>
      <ul className={styles.summaryList}>
        {STANDARD_GESTURES.map((g) => (
          <li key={g.id} className={styles.classGroup}>
            <div
              className={`${styles.summaryItem} ${selection?.kind === "standard" && selection.id === g.id ? styles.selected : ""}`}
              onClick={() => store.selectStandard(g.id)}
              title="Click to visualize this gesture"
            >
              <input
                type="checkbox"
                className={styles.templateCheckbox}
                checked={store.checkedStandards.has(g.id)}
                onChange={() => store.toggleStandard(g.id)}
                onClick={(e) => e.stopPropagation()}
                title="Select for template generation"
              />
              <span className={styles.gestureName}>{g.label}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default GestureSummary;
